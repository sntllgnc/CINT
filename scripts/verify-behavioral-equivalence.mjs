import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [baselineRoot, candidateRoot, artifactPath] = process.argv.slice(2);
assert.ok(baselineRoot && candidateRoot, "usage: verify-behavioral-equivalence.mjs <r0-root> <compiled-r1-root>");

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2 = "2026-08-27T00:10:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";
const TARGET = Object.freeze({ path: "target.txt" });

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function hashBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sourceSurface(root, expression) {
  const values = new Set();
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      const content = await readFile(absolute, "utf8");
      for (const match of content.matchAll(expression)) values.add(match[1]);
    }
  }
  await walk(path.join(path.resolve(root), "src", "cint"));
  return [...values].sort();
}

async function schemaInventory(root) {
  const directory = path.join(path.resolve(root), "schemas", "cint");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".schema.json")).sort();
  return Object.fromEntries(await Promise.all(files.map(async (name) => [name, hashBytes(await readFile(path.join(directory, name)))])));
}

function property(value, name) {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

function errorCode(error) {
  return typeof property(error, "code") === "string" ? property(error, "code") : "UNKNOWN";
}

async function loadImplementation(root) {
  const absolute = path.resolve(root);
  const module = (relative) => import(pathToFileURL(path.join(absolute, relative)).href);
  return {
    api: await module("src/cint/index.js"),
    synthetic: await module("src/cint/adapters/synthetic-file-patch.js"),
    codex: await module("src/cint/adapters/codex/index.js"),
    demo: await module("src/demo.js"),
    policy: await module("src/policy.js")
  };
}

function baseRecords(implementation, intentOverrides = {}) {
  const { api } = implementation;
  const before = "0".repeat(64);
  const intent = api.createIntent({
    id: "intent.equivalence.1",
    principal_id: "principal.operator",
    request: Object.hasOwn(intentOverrides, "request") ? intentOverrides.request : "Apply the deterministic synthetic patch.",
    action: {
      adapter: "cint.adapter.synthetic-file-patch",
      type: "SYNTHETIC_FILE_PATCH",
      target: TARGET,
      parameters: { content: "after\n", expected_before_sha256: before },
      consequence: "CONSEQUENTIAL"
    },
    declared_effects: ["Replace the declared disposable target bytes"],
    context: { workspace: "equivalence" },
    uncertainties: intentOverrides.uncertainties ?? [],
    created_at: T0
  });
  const principal = api.resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.equivalence.1"],
    attributes: {},
    resolved_at: T0
  });
  const authority = api.createAuthorityGrant({
    id: "authority.equivalence.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [{ adapter: "cint.adapter.synthetic-file-patch", type: "SYNTHETIC_FILE_PATCH", target: TARGET }],
    policy_ids: ["policy.equivalence"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const policy = api.createPolicySnapshot({
    id: "policy.equivalence",
    version: "r0.1",
    epoch: 1,
    allowed_adapters: ["cint.adapter.synthetic-file-patch"],
    allowed_action_types: ["SYNTHETIC_FILE_PATCH"],
    denied_action_types: [],
    require_explicit_request: true,
    require_declared_effects: true,
    require_rollback_for_consequential: true,
    review_on_uncertainty: true,
    issued_at: T0
  });
  const adapter_capability = api.createAdapterCapability({
    id: "cint.adapter.synthetic-file-patch",
    action_types: ["SYNTHETIC_FILE_PATCH"],
    consequence_classes: ["CONSEQUENTIAL"],
    prepare_side_effect_free: true,
    rollback: true,
    interrupt: true,
    outcome_verification: true
  });
  const machine_state = api.createMachineStateSnapshot({
    id: "machine.equivalence",
    epoch: 1,
    available: true,
    state: { mode: "READY" },
    observed_at: T0
  });
  return { intent, principal, authority, policy, adapter_capability, machine_state };
}

function decisionFor(implementation, disposition) {
  const overrides = disposition === "DENY"
    ? { request: null }
    : disposition === "REVIEW"
      ? { uncertainties: ["operator confirmation pending"] }
      : {};
  const records = baseRecords(implementation, overrides);
  return implementation.api.decide({
    id: `decision.equivalence.${disposition.toLowerCase()}`,
    ...records,
    now: T1,
    expires_at: T2
  });
}

function normalizedDecision(implementation, disposition) {
  const decision = decisionFor(implementation, disposition);
  return {
    status: decision.status,
    receipt_eligible: decision.receipt_eligible,
    error_codes: decision.reason_codes,
    digest: decision.digest,
    binding_digest: decision.binding_digest
  };
}

function receiptVector(implementation) {
  const decision = decisionFor(implementation, "ADMIT");
  const authority = new implementation.api.DecisionReceiptAuthority({
    issuer_id: "cint.receipt-authority.equivalence",
    key: Buffer.alloc(32, 7)
  });
  const receipt = authority.issue({
    id: "receipt.equivalence.issued",
    nonce: "receipt-equivalence-nonce-0001",
    decision,
    issued_at: T1
  });
  authority.verify(receipt, { now: T1 });
  return {
    status: receipt.status,
    digest: receipt.digest,
    signature: receipt.signature,
    decision_digest: receipt.decision_digest,
    binding_digest: receipt.binding_digest
  };
}

async function receiptStoreScenario(implementation, race) {
  const root = await mkdtemp(path.join(os.tmpdir(), "cint-equivalence-store-"));
  try {
    const decision = decisionFor(implementation, "ADMIT");
    const authority = new implementation.api.DecisionReceiptAuthority({
      issuer_id: "cint.receipt-authority.equivalence",
      key: Buffer.alloc(32, 7)
    });
    const receipt = authority.issue({
      id: "receipt.equivalence.store",
      nonce: "receipt-equivalence-store-0001",
      decision,
      issued_at: T1
    });
    const store = new implementation.api.FileReceiptStore(path.join(root, "store"));
    await store.register(receipt, { registered_at: T1 });
    const revalidate = async () => ({ status: "VALID", reason_codes: [], digest: "a".repeat(64) });
    if (race) {
      const attempts = await Promise.allSettled([
        store.consume(receipt, { consumed_at: T1, revalidate }),
        store.consume(receipt, { consumed_at: T1, revalidate })
      ]);
      return {
        fulfilled: attempts.filter((item) => item.status === "fulfilled").length,
        rejected: attempts.filter((item) => item.status === "rejected").map((item) => errorCode(item.reason)).sort(),
        store_state: (await store.inspect(receipt.id)).state
      };
    }
    await store.consume(receipt, { consumed_at: T1, revalidate });
    let replayCode = null;
    try {
      await store.consume(receipt, { consumed_at: T1, revalidate });
    } catch (error) {
      replayCode = errorCode(error);
    }
    return { replay_code: replayCode, store_state: (await store.inspect(receipt.id)).state };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function clock(initial = T1) {
  let current = initial;
  return Object.freeze({ now: () => current, set: (next) => { current = next; } });
}

async function withSyntheticRuntime(implementation, run) {
  const { api } = implementation;
  const root = await mkdtemp(path.join(os.tmpdir(), "cint-equivalence-runtime-"));
  const target = path.join(root, "target.txt");
  const initial = Buffer.from("before\n", "utf8");
  await writeFile(target, initial);
  const beforeSha256 = hashBytes(initial);
  const adapter = new implementation.synthetic.SyntheticFilePatchAdapter(root);
  const intent = api.createIntent({
    id: "intent.execution.1",
    principal_id: "principal.operator",
    request: "Apply the bounded synthetic file patch.",
    action: {
      adapter: "cint.adapter.synthetic-file-patch",
      type: "SYNTHETIC_FILE_PATCH",
      target: TARGET,
      parameters: { content: "after\n", expected_before_sha256: beforeSha256 },
      consequence: "CONSEQUENTIAL"
    },
    declared_effects: ["Replace the declared disposable target bytes"],
    context: { workspace: "synthetic-proof" },
    uncertainties: [],
    created_at: T0
  });
  const principal = api.resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.execution.1"],
    attributes: {},
    resolved_at: T0
  });
  const authority = api.createAuthorityGrant({
    id: "authority.execution.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [{ adapter: "cint.adapter.synthetic-file-patch", type: "SYNTHETIC_FILE_PATCH", target: TARGET }],
    policy_ids: ["policy.execution"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const makePolicy = (overrides = {}) => api.createPolicySnapshot({
    id: "policy.execution",
    version: overrides.version ?? "r0.1",
    epoch: overrides.epoch ?? 1,
    allowed_adapters: ["cint.adapter.synthetic-file-patch"],
    allowed_action_types: ["SYNTHETIC_FILE_PATCH"],
    denied_action_types: [],
    require_explicit_request: true,
    require_declared_effects: true,
    require_rollback_for_consequential: true,
    review_on_uncertainty: true,
    issued_at: overrides.issued_at ?? T0
  });
  const policy = makePolicy();
  const machine_state = api.createMachineStateSnapshot({
    id: "machine.synthetic",
    epoch: 1,
    available: true,
    state: { mode: "READY", target_sha256: beforeSha256 },
    observed_at: T0
  });
  const snapshot = { intent, principal, authority, policy, adapter_capability: adapter.capability, machine_state };
  const decision = api.decide({ id: "decision.execution.1", ...snapshot, now: T1, expires_at: T2 });
  const receipt_authority = new api.DecisionReceiptAuthority({ issuer_id: "cint.receipt-authority.r0", key: Buffer.alloc(32, 11) });
  const receipt = receipt_authority.issue({
    id: "receipt.execution.1",
    nonce: "execution-receipt-nonce-0001",
    decision,
    issued_at: T1
  });
  const store = new api.FileReceiptStore(path.join(root, "receipt-store"));
  await store.register(receipt, { registered_at: T1 });
  const seal_authority = new api.OutcomeSealAuthority({ issuer_id: "cint.seal-authority.r0", key: Buffer.alloc(32, 19) });
  const ledger = new api.ExecutionLedger(path.join(root, "evidence", "execution.jsonl"));
  const trustedClock = clock();
  const runtime = {
    api,
    root,
    target,
    beforeSha256,
    adapter,
    intent,
    principal,
    authority,
    policy,
    makePolicy,
    machine_state,
    snapshot,
    receipt,
    receipt_authority,
    store,
    seal_authority,
    ledger,
    clock: trustedClock,
    execute: (overrides = {}) => api.executeWithReceipt({
      receipt,
      receipt_authority,
      store,
      snapshot_provider: async () => snapshot,
      clock: trustedClock,
      adapter,
      seal_authority,
      ledger,
      at: T1,
      ...overrides
    })
  };
  try {
    return await run(runtime);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function normalizedExecution(runtime, result, extras = {}) {
  return {
    status: result.status,
    error_code: result.error_code,
    action_started: result.action_started,
    outcome_status: result.outcome?.status ?? null,
    effect_status: result.outcome?.effect_status ?? null,
    outcome_digest: result.outcome?.digest ?? null,
    final_state_digest: result.outcome?.final_state_digest ?? null,
    target_sha256: hashBytes(await readFile(runtime.target)),
    store_state: (await runtime.store.inspect(runtime.receipt.id)).state,
    ...extras
  };
}

function adapterProxy(runtime, onPrepared) {
  return {
    id: runtime.adapter.id,
    capability: runtime.adapter.capability,
    prepare: async (...args) => {
      const prepared = await runtime.adapter.prepare(...args);
      await onPrepared();
      return prepared;
    },
    execute: runtime.adapter.execute.bind(runtime.adapter),
    verify: runtime.adapter.verify.bind(runtime.adapter),
    rollback: runtime.adapter.rollback.bind(runtime.adapter)
  };
}

async function driftScenario(implementation, kind) {
  return withSyntheticRuntime(implementation, async (runtime) => {
    let active = runtime.snapshot;
    let executeCalls = 0;
    const adapter = adapterProxy(runtime, async () => {
      if (kind === "expiry") runtime.clock.set(T2);
      if (kind === "policy") active = { ...active, policy: runtime.makePolicy({ version: "r0.2", epoch: 2, issued_at: T1 }) };
      if (kind === "authority") {
        active = { ...active, authority: runtime.api.revokeAuthority(runtime.authority, { revoked_at: T1, reason: "Authority withdrawn" }) };
      }
      if (kind === "machine") {
        active = {
          ...active,
          machine_state: runtime.api.createMachineStateSnapshot({
            id: "machine.synthetic",
            epoch: 2,
            available: true,
            state: { mode: "DRIFTED" },
            observed_at: T1
          })
        };
      }
      if (kind === "adapter") {
        active = {
          ...active,
          adapter_capability: runtime.api.createAdapterCapability({
            id: "cint.adapter.synthetic-file-patch",
            action_types: ["SYNTHETIC_FILE_PATCH"],
            consequence_classes: ["CONSEQUENTIAL"],
            prepare_side_effect_free: true,
            rollback: true,
            interrupt: false,
            outcome_verification: true
          })
        };
      }
    });
    adapter.execute = async (...args) => {
      executeCalls += 1;
      return runtime.adapter.execute(...args);
    };
    const result = await runtime.execute({ adapter, snapshot_provider: async () => active });
    return normalizedExecution(runtime, result, { execute_calls: executeCalls });
  });
}

function rehash(api, record, changes) {
  const { digest: ignored, ...unsigned } = record;
  const changed = { ...unsigned, ...changes };
  return { ...changed, digest: api.canonicalDigest(changed) };
}

async function alienProtocolScenario(implementation) {
  return withSyntheticRuntime(implementation, async (runtime) => {
    const alien = rehash(runtime.api, runtime.adapter.capability, {
      protocol: "not-cint/adapter-capability/999",
      forbidden_field: true
    });
    const result = runtime.api.revalidateReceipt({
      receipt: runtime.receipt,
      receipt_authority: runtime.receipt_authority,
      ...runtime.snapshot,
      adapter_capability: alien,
      now: T1
    });
    return { status: result.status, reason_codes: [...result.reason_codes].sort() };
  });
}

function forbiddenFieldScenario(implementation) {
  const records = baseRecords(implementation);
  const intent = rehash(implementation.api, records.intent, { forbidden_field: true });
  try {
    implementation.api.decide({ id: "decision.equivalence.forbidden", ...records, intent, now: T1, expires_at: T2 });
    return { admitted: true, error_code: null };
  } catch (error) {
    return { admitted: false, error_code: errorCode(error) };
  }
}

async function successfulOutcomeScenario(implementation) {
  return withSyntheticRuntime(implementation, async (runtime) => normalizedExecution(runtime, await runtime.execute()));
}

async function rollbackScenario(implementation) {
  return withSyntheticRuntime(implementation, async (runtime) => {
    const adapter = {
      id: runtime.adapter.id,
      capability: runtime.adapter.capability,
      prepare: runtime.adapter.prepare.bind(runtime.adapter),
      execute: runtime.adapter.execute.bind(runtime.adapter),
      verify: async (...args) => {
        const verified = await runtime.adapter.verify(...args);
        return rehash(runtime.api, verified, { status: "DIVERGED", actual_sha256: "f".repeat(64) });
      },
      rollback: runtime.adapter.rollback.bind(runtime.adapter)
    };
    return normalizedExecution(runtime, await runtime.execute({ adapter }));
  });
}

async function failClosedScenario(implementation) {
  return withSyntheticRuntime(implementation, async (runtime) => {
    const result = await runtime.execute({ clock: null });
    return normalizedExecution(runtime, result);
  });
}

async function adapter01Scenario(implementation) {
  const { api } = implementation;
  const temporary = await mkdtemp(path.join(os.tmpdir(), "cint-equivalence-adapter01-"));
  const output = path.join(temporary, "legacy-output");
  try {
    const mock = path.join(implementation.demo.PROJECT_ROOT, "fixtures", "sanitized-af-g0", "mock-codex.mjs");
    await chmod(mock, 0o755);
    const { spec: loadedSpec } = await implementation.policy.loadTaskSpec(implementation.demo.DEMO_SPEC);
    const spec = { ...loadedSpec, delegation: { ...loadedSpec.delegation, max_concurrency: 2 } };
    const action = await implementation.codex.createCodexDelegationAction(spec);
    const intent = api.createIntent({
      id: "intent.codex-equivalence.1",
      principal_id: "principal.operator",
      request: "Run the bounded read-only delegated review.",
      action,
      declared_effects: ["Execute one read-only delegated review and write local run evidence"],
      context: { adapter: "legacy-af-g0" },
      uncertainties: [],
      created_at: T0
    });
    const principal = api.resolvePrincipal({
      id: "principal.operator",
      type: "HUMAN",
      authenticated: true,
      authority_chain: ["authority.codex-equivalence.1"],
      attributes: {},
      resolved_at: T0
    });
    const authority = api.createAuthorityGrant({
      id: "authority.codex-equivalence.1",
      principal_id: "principal.operator",
      issuer_id: "principal.authority",
      epoch: 1,
      grants: [{ adapter: action.adapter, type: action.type, target: action.target }],
      policy_ids: ["policy.codex-equivalence"],
      require_rollback: false,
      issued_at: T0,
      not_before: T0,
      expires_at: EXPIRY
    });
    const policy = api.createPolicySnapshot({
      id: "policy.codex-equivalence",
      version: "r0.1",
      epoch: 1,
      allowed_adapters: [action.adapter],
      allowed_action_types: [action.type],
      denied_action_types: [],
      require_explicit_request: true,
      require_declared_effects: true,
      require_rollback_for_consequential: true,
      review_on_uncertainty: true,
      issued_at: T0
    });
    const adapter = new implementation.codex.CodexDelegationCintAdapter({
      spec,
      output_dir: output,
      codex_binary: process.execPath,
      codex_args: [mock]
    });
    const machine_state = api.createMachineStateSnapshot({
      id: "machine.codex-equivalence",
      epoch: 1,
      available: true,
      state: { packet_sha256: action.target.packet_sha256, mode: "READY" },
      observed_at: T0
    });
    const snapshot = { intent, principal, authority, policy, adapter_capability: adapter.capability, machine_state };
    const decision = api.decide({ id: "decision.codex-equivalence.1", ...snapshot, now: T1, expires_at: T2 });
    const receipt_authority = new api.DecisionReceiptAuthority({ issuer_id: "cint.receipt-authority.r0", key: Buffer.alloc(32, 23) });
    const receipt = receipt_authority.issue({
      id: "receipt.codex-equivalence.1",
      nonce: "codex-equivalence-receipt-0001",
      decision,
      issued_at: T1
    });
    const store = new api.FileReceiptStore(path.join(temporary, "receipt-store"));
    await store.register(receipt, { registered_at: T1 });
    const seal_authority = new api.OutcomeSealAuthority({ issuer_id: "cint.seal-authority.r0", key: Buffer.alloc(32, 29) });
    const ledger = new api.ExecutionLedger(path.join(temporary, "evidence", "execution.jsonl"));
    const result = await api.executeWithReceipt({
      receipt,
      receipt_authority,
      store,
      snapshot_provider: async () => snapshot,
      clock: { now: () => T1 },
      adapter,
      seal_authority,
      ledger,
      at: T1
    });
    const legacy = JSON.parse(await readFile(path.join(output, "run.json"), "utf8"));
    return {
      execution_status: result.status,
      outcome_status: result.outcome?.status ?? null,
      effect_status: result.outcome?.effect_status ?? null,
      store_state: (await store.inspect(receipt.id)).state,
      admission: legacy.admission.result,
      context_mode: legacy.admission.context_mode,
      inherited_turns: legacy.context_enforcement.inherited_turns,
      evidence_count: legacy.admission.evidence.length,
      authority_operations: Object.values(adapter.authority_boundary),
      capability: {
        consequence: adapter.capability.consequence_classes,
        prepare_side_effect_free: adapter.capability.prepare_side_effect_free,
        outcome_verification: adapter.capability.outcome_verification
      }
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function afTelemetryScenario(implementation) {
  const output = await mkdtemp(path.join(os.tmpdir(), "cint-equivalence-af-g0-"));
  try {
    const result = await implementation.demo.runDemo({ outputDir: output });
    return {
      verdict: result.verdict,
      context_mode: result.context_mode,
      fork_turns: result.fork_turns,
      model_calls: result.model_calls,
      incremental_tokens: result.incremental_tokens,
      cached_input_tokens: result.cached_input_tokens,
      fresh_input_tokens: result.fresh_input_tokens,
      output_tokens: result.output_tokens,
      result: result.result,
      raw_cumulative_tokens: result.historical_regression.raw_cumulative_tokens,
      request_local_incremental_tokens: result.historical_regression.request_local_incremental_tokens,
      duplicate_usage_events_removed: result.historical_regression.duplicate_usage_events_removed,
      cumulative_delta_matches_incremental: result.historical_regression.cumulative_delta_matches_incremental,
      checks: result.checks
    };
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}

const baseline = await loadImplementation(baselineRoot);
const candidate = await loadImplementation(candidateRoot);
const baselineErrors = await sourceSurface(baselineRoot, /(CINT_[A-Z0-9_]+)/gu);
const candidateErrors = await sourceSurface(candidateRoot, /(CINT_[A-Z0-9_]+)/gu);
const baselineProtocols = await sourceSurface(baselineRoot, /["'](cint\/[a-z0-9-]+\/1)["']/gu);
const candidateProtocols = await sourceSurface(candidateRoot, /["'](cint\/[a-z0-9-]+\/1)["']/gu);
const baselineSchemas = await schemaInventory(baselineRoot);
const candidateSchemas = await schemaInventory(candidateRoot);
assert.deepEqual(candidateErrors, baselineErrors, "compiled CINT error-code surface differs from R0");
assert.deepEqual(candidateProtocols, baselineProtocols, "compiled CINT protocol surface differs from R0");
assert.deepEqual(candidateSchemas, baselineSchemas, "compiled CINT schema bytes differ from R0");
const scenarios = [
  ["ADMIT", (implementation) => normalizedDecision(implementation, "ADMIT")],
  ["DENY", (implementation) => normalizedDecision(implementation, "DENY")],
  ["REVIEW", (implementation) => normalizedDecision(implementation, "REVIEW")],
  ["RECEIPT_ISSUE_AND_VERIFICATION", receiptVector],
  ["ONE_SHOT_CONSUMPTION_RACE", (implementation) => receiptStoreScenario(implementation, true)],
  ["REPLAY_REJECTION", (implementation) => receiptStoreScenario(implementation, false)],
  ["EXPIRY_DURING_PREPARATION", (implementation) => driftScenario(implementation, "expiry")],
  ["POLICY_DRIFT", (implementation) => driftScenario(implementation, "policy")],
  ["AUTHORITY_DRIFT", (implementation) => driftScenario(implementation, "authority")],
  ["MACHINE_STATE_DRIFT", (implementation) => driftScenario(implementation, "machine")],
  ["ADAPTER_CAPABILITY_DRIFT", (implementation) => driftScenario(implementation, "adapter")],
  ["ALIEN_PROTOCOL_REJECTION", alienProtocolScenario],
  ["FORBIDDEN_FIELD_REJECTION", forbiddenFieldScenario],
  ["OUTCOME_VERIFICATION", successfulOutcomeScenario],
  ["ROLLBACK_AND_RESTORED_HASH", rollbackScenario],
  ["FAIL_CLOSED_DEPENDENCY_CHECKS", failClosedScenario],
  ["ADAPTER_01_EVIDENCE_ADMISSION", adapter01Scenario],
  ["AF_G0_TELEMETRY_REGRESSION", afTelemetryScenario]
];

const results = [];
for (const [id, run] of scenarios) {
  const baselineOutput = await run(baseline);
  const candidateOutput = await run(candidate);
  assert.deepEqual(candidateOutput, baselineOutput, `${id} differs from v0.1.0-cint-r0`);
  results.push({ id, verdict: "PASS", normalized_sha256: digest(candidateOutput), output: candidateOutput });
}

if (artifactPath !== undefined) {
  const artifact = JSON.parse(await readFile(path.resolve(artifactPath), "utf8"));
  assert.equal(artifact.verdict, "PASS", "behavioral-equivalence artifact is not PASS");
  assert.equal(artifact.scenario_count, results.length, "behavioral-equivalence artifact count differs");
  assert.deepEqual(
    artifact.scenarios.map(({ id, normalized_sha256 }) => ({ id, normalized_sha256 })),
    results.map(({ id, normalized_sha256 }) => ({ id, normalized_sha256 })),
    "behavioral-equivalence artifact hashes differ from the current run"
  );
  assert.equal(artifact.frozen_surfaces.runtime_schema_files_identical, `${Object.keys(candidateSchemas).length}/${Object.keys(baselineSchemas).length}`);
  assert.equal(artifact.frozen_surfaces.protocol_identifier_set, `${candidateProtocols.length}/${baselineProtocols.length} identical`);
  assert.equal(artifact.frozen_surfaces.error_code_set, `${candidateErrors.length}/${baselineErrors.length} identical`);
}

console.log(JSON.stringify({
  protocol: "cint-r1/behavioral-equivalence/1",
  baseline: "v0.1.0-cint-r0",
  candidate: "cint-r1-typescript",
  normalization: {
    excluded: ["generated UUIDs", "temporary absolute paths", "runtime-generated timestamps"],
    retained: ["statuses", "error codes", "canonical digests", "HMAC signature", "store states", "target hashes", "AF-G0 counters"]
  },
  scenario_count: results.length,
  passed: results.length,
  failed: 0,
  artifact_verification: artifactPath === undefined ? "NOT_REQUESTED" : "PASS",
  scenarios: results,
  frozen_surfaces: {
    runtime_schema_files_identical: `${Object.keys(candidateSchemas).length}/${Object.keys(baselineSchemas).length}`,
    protocol_identifier_set: `${candidateProtocols.length}/${baselineProtocols.length} identical`,
    error_code_set: `${candidateErrors.length}/${baselineErrors.length} identical`
  },
  verdict: "PASS"
}, null, 2));
