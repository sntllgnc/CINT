import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DecisionReceiptAuthority,
  ExecutionLedger,
  FileReceiptStore,
  OutcomeSealAuthority,
  createAuthorityGrant,
  createIntent,
  createMachineStateSnapshot,
  createPolicySnapshot,
  decide,
  executeWithReceipt,
  resolvePrincipal
} from "../src/cint/index.js";
import {
  CodexDelegationCintAdapter,
  createCodexDelegationAction
} from "../src/cint/adapters/codex/index.js";
import { DEMO_SPEC, PROJECT_ROOT } from "../src/demo.js";
import { loadTaskSpec } from "../src/policy.js";

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2 = "2026-08-27T00:10:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";

async function withAdapterRuntime(run) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "cint-codex-adapter-test-"));
  const output = path.join(temporary, "legacy-output");
  const mock = path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "mock-codex.mjs");
  await chmod(mock, 0o755);
  const { spec: loadedSpec } = await loadTaskSpec(DEMO_SPEC);
  const spec = {
    ...loadedSpec,
    delegation: { ...loadedSpec.delegation, max_concurrency: 2 }
  };
  const action = await createCodexDelegationAction(spec);
  const intent = createIntent({
    id: "intent.codex-adapter.1",
    principal_id: "principal.operator",
    request: "Run the bounded read-only delegated review and return its verified evidence.",
    action,
    declared_effects: ["Execute one read-only delegated review and write local run evidence"],
    context: { adapter: "legacy-af-g0" },
    uncertainties: [],
    created_at: T0
  });
  const principal = resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.codex-adapter.1"],
    attributes: {},
    resolved_at: T0
  });
  const authority = createAuthorityGrant({
    id: "authority.codex-adapter.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [{ adapter: action.adapter, type: action.type, target: action.target }],
    policy_ids: ["policy.codex-adapter"],
    require_rollback: false,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const policy = createPolicySnapshot({
    id: "policy.codex-adapter",
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
  const adapter = new CodexDelegationCintAdapter({ spec, output_dir: output, codex_binary: mock });
  const machine_state = createMachineStateSnapshot({
    id: "machine.codex-adapter",
    epoch: 1,
    available: true,
    state: { packet_sha256: action.target.packet_sha256, mode: "READY" },
    observed_at: T0
  });
  const snapshot = {
    intent,
    principal,
    authority,
    policy,
    adapter_capability: adapter.capability,
    machine_state
  };
  const decision = decide({
    id: "decision.codex-adapter.1",
    ...snapshot,
    now: T1,
    expires_at: T2
  });
  const receipt_authority = new DecisionReceiptAuthority({
    issuer_id: "cint.receipt-authority.r0",
    key: Buffer.alloc(32, 23)
  });
  const receipt = receipt_authority.issue({
    id: "receipt.codex-adapter.1",
    nonce: "codex-adapter-receipt-0001",
    decision,
    issued_at: T1
  });
  const store = new FileReceiptStore(path.join(temporary, "receipt-store"));
  await store.register(receipt, { registered_at: T1 });
  const seal_authority = new OutcomeSealAuthority({
    issuer_id: "cint.seal-authority.r0",
    key: Buffer.alloc(32, 29)
  });
  const ledger = new ExecutionLedger(path.join(temporary, "evidence", "execution.jsonl"));
  try {
    return await run({
      temporary,
      output,
      mock,
      spec,
      action,
      intent,
      snapshot,
      decision,
      adapter,
      receipt,
      receipt_authority,
      store,
      seal_authority,
      ledger
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

test("Codex Adapter 01 exposes no CINT authority operation", async () => {
  await withAdapterRuntime(async ({ adapter }) => {
    assert.equal(adapter.capability.consequence_classes[0], "READ_ONLY");
    assert.equal(adapter.decide, undefined);
    assert.equal(adapter.issue, undefined);
    assert.equal(adapter.consume, undefined);
    assert.equal(adapter.seal, undefined);
    assert(Object.values(adapter.authority_boundary).every((value) => value === false));
  });
});

test("legacy bounded review runs only under a consumed CINT receipt", async () => {
  await withAdapterRuntime(async (runtime) => {
    const result = await executeWithReceipt({
      receipt: runtime.receipt,
      receipt_authority: runtime.receipt_authority,
      store: runtime.store,
      snapshot_provider: async () => runtime.snapshot,
      adapter: runtime.adapter,
      seal_authority: runtime.seal_authority,
      ledger: runtime.ledger,
      at: T1
    });
    assert.equal(result.status, "SEALED");
    assert.equal(result.outcome.status, "VERIFIED");
    assert.equal(result.outcome.effect_status, "APPLIED");
    runtime.seal_authority.verify(result.evidence_seal);
    const legacy = JSON.parse(await readFile(path.join(runtime.output, "run.json"), "utf8"));
    assert.equal(legacy.admission.result, "ADMITTED");
    assert.equal(legacy.context_enforcement.inherited_turns, 0);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "CONSUMED");
  });
});

test("legacy packet drift is rejected before Codex execution", async () => {
  await withAdapterRuntime(async (runtime) => {
    const changedSpec = { ...runtime.spec, root_task: `${runtime.spec.root_task} changed` };
    const changedAdapter = new CodexDelegationCintAdapter({
      spec: changedSpec,
      output_dir: runtime.output,
      codex_binary: runtime.mock
    });
    await assert.rejects(
      changedAdapter.prepare(runtime.intent, { at: T1 }),
      (error) => error.code === "CINT_CODEX_PACKET_CHANGED"
    );
  });
});
