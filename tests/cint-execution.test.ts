import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CintError,
  CINT_SCHEMA_PROTOCOLS,
  DecisionReceiptAuthority,
  ExecutionLedger,
  FileReceiptStore,
  OutcomeSealAuthority,
  canonicalDigest,
  createAdapterCapability,
  createAuthorityGrant,
  createIntent,
  createMachineStateSnapshot,
  createPolicySnapshot,
  decide,
  executeWithReceipt,
  resolvePrincipal,
  revalidateReceipt,
  revokeAuthority,
  runCounterIntentChallenge,
  sealRecord,
  sha256,
  validateCintSchema,
  verifyProtocolRecord
} from "../src/cint/index.js";
import { SyntheticFilePatchAdapter } from "../src/cint/adapters/synthetic-file-patch.js";
import type {
  ExecutionAdapter,
  ExecutionSnapshot
} from "../src/cint/execution.js";
import {
  executeUntrusted,
  hasErrorCode,
  issueUntrusted,
  requireAdmit
} from "./cint-test-support.js";

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2_BEFORE = "2026-08-27T00:09:59.999Z";
const T2 = "2026-08-27T00:10:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";

function createTestClock(initial: string = T1) {
  let current = initial;
  return Object.freeze({
    now: () => current,
    set: (next: string) => {
      current = next;
    }
  });
}

function adapterAdvancingClock(
  runtime: ExecutionRuntime,
  next: string,
  counters: { execute_calls: number } = { execute_calls: 0 }
): ExecutionAdapter {
  const adapter: ExecutionAdapter = runtime.adapter;
  return {
    id: adapter.id,
    capability: adapter.capability,
    prepare: async (intent, options) => {
      const prepared = await adapter.prepare(intent, options);
      runtime.clock.set(next);
      return prepared;
    },
    execute: async (prepared, options) => {
      counters.execute_calls += 1;
      return adapter.execute(prepared, options);
    },
    verify: (prepared, execution, options) => adapter.verify(prepared, execution, options),
    rollback: async (prepared, options) => {
      if (adapter.rollback === undefined) throw new Error("test adapter must support rollback");
      return adapter.rollback(prepared, options);
    }
  };
}

interface AdapterHooks {
  readonly capability?: ExecutionAdapter["capability"];
  readonly afterPrepare?: () => void | Promise<void>;
  readonly beforeExecute?: () => void | Promise<void>;
}

function adapterWithHooks(runtime: ExecutionRuntime, hooks: AdapterHooks = {}): ExecutionAdapter {
  const adapter: ExecutionAdapter = runtime.adapter;
  return {
    id: adapter.id,
    capability: hooks.capability ?? adapter.capability,
    prepare: async (intent, options) => {
      const prepared = await adapter.prepare(intent, options);
      await hooks.afterPrepare?.();
      return prepared;
    },
    execute: async (prepared, options) => {
      await hooks.beforeExecute?.();
      return adapter.execute(prepared, options);
    },
    verify: (prepared, execution, options) => adapter.verify(prepared, execution, options),
    rollback: async (prepared, options) => {
      if (adapter.rollback === undefined) throw new Error("test adapter must support rollback");
      return adapter.rollback(prepared, options);
    }
  };
}

function rehashRecord(record: object, overrides: Readonly<Record<string, unknown>>) {
  const unsigned = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "digest"));
  const changed = { ...unsigned, ...overrides };
  return { ...changed, digest: canonicalDigest(changed) };
}

interface IntentOverrides {
  readonly id?: unknown;
  readonly request?: unknown;
  readonly action?: unknown;
  readonly content?: unknown;
  readonly declared_effects?: unknown;
  readonly context?: unknown;
  readonly uncertainties?: unknown;
}

interface PolicyOverrides {
  readonly version?: unknown;
  readonly epoch?: unknown;
  readonly issued_at?: unknown;
}

async function createRuntime() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cint-execution-test-"));
  const target = path.join(root, "target.txt");
  const initial = Buffer.from("before\n", "utf8");
  await writeFile(target, initial);
  const targetObject = Object.freeze({ path: "target.txt" });
  const beforeSha256 = sha256(initial);

  const makeIntent = (overrides: IntentOverrides = {}) =>
    createIntent({
      id: overrides.id ?? "intent.execution.1",
      principal_id: "principal.operator",
      request: Object.hasOwn(overrides, "request") ? overrides.request : "Apply the bounded synthetic file patch.",
      action:
        overrides.action ??
        {
          adapter: "cint.adapter.synthetic-file-patch",
          type: "SYNTHETIC_FILE_PATCH",
          target: targetObject,
          parameters: { content: overrides.content ?? "after\n", expected_before_sha256: beforeSha256 },
          consequence: "CONSEQUENTIAL"
        },
      declared_effects: overrides.declared_effects ?? ["Replace the declared disposable target bytes"],
      context: overrides.context ?? { workspace: "synthetic-proof" },
      uncertainties: overrides.uncertainties ?? [],
      created_at: T0
    });
  const principal = resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.execution.1"],
    attributes: {},
    resolved_at: T0
  });
  const authority = createAuthorityGrant({
    id: "authority.execution.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [
      {
        adapter: "cint.adapter.synthetic-file-patch",
        type: "SYNTHETIC_FILE_PATCH",
        target: targetObject
      }
    ],
    policy_ids: ["policy.execution"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const makePolicy = (overrides: PolicyOverrides = {}) =>
    createPolicySnapshot({
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
  const adapter = new SyntheticFilePatchAdapter(root);
  const machine_state = createMachineStateSnapshot({
    id: "machine.synthetic",
    epoch: 1,
    available: true,
    state: { mode: "READY", target_sha256: beforeSha256 },
    observed_at: T0
  });
  const intent = makeIntent();
  const snapshot = {
    intent,
    principal,
    authority,
    policy,
    adapter_capability: adapter.capability,
    machine_state
  };
  const decision = decide({
    id: "decision.execution.1",
    ...snapshot,
    now: T1,
    expires_at: T2
  });
  const receipt_authority = new DecisionReceiptAuthority({
    issuer_id: "cint.receipt-authority.r0",
    key: Buffer.alloc(32, 11)
  });
  const receipt = receipt_authority.issue({
    id: "receipt.execution.1",
    nonce: "execution-receipt-nonce-0001",
    decision: requireAdmit(decision),
    issued_at: T1
  });
  const store = new FileReceiptStore(path.join(root, "receipt-store"));
  await store.register(receipt, { registered_at: T1 });
  const seal_authority = new OutcomeSealAuthority({
    issuer_id: "cint.seal-authority.r0",
    key: Buffer.alloc(32, 19)
  });
  const ledger = new ExecutionLedger(path.join(root, "evidence", "execution.jsonl"));
  const clock = createTestClock();

  const runtime = {
    root,
    target,
    initial,
    beforeSha256,
    targetObject,
    makeIntent,
    makePolicy,
    principal,
    authority,
    policy,
    adapter,
    machine_state,
    snapshot,
    decision,
    receipt,
    receipt_authority,
    store,
    seal_authority,
    ledger,
    clock,
    execute: (overrides: Readonly<Record<string, unknown>> = {}) =>
      executeUntrusted({
        receipt,
        receipt_authority,
        store,
        snapshot_provider: async () => snapshot,
        clock,
        adapter,
        seal_authority,
        ledger,
        at: T1,
        ...overrides
      })
  };
  return {
    runtime,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

type ExecutionRuntime = Awaited<ReturnType<typeof createRuntime>>["runtime"];

async function withRuntime<Result>(
  run: (runtime: ExecutionRuntime) => Promise<Result>
): Promise<Result> {
  const created = await createRuntime();
  try {
    return await run(created.runtime);
  } finally {
    await created.cleanup();
  }
}

test("bounded synthetic mutation is admitted, verified, and sealed", async () => {
  await withRuntime(async (runtime) => {
    const result = await runtime.execute();
    assert.equal(result.status, "SEALED");
    assert.equal(result.outcome.status, "VERIFIED");
    assert.equal(result.outcome.effect_status, "APPLIED");
    assert.equal(await readFile(runtime.target, "utf8"), "after\n");
    assert.equal(runtime.seal_authority.verify(result.evidence_seal), result.evidence_seal);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "CONSUMED");
    const ledgerHead = await runtime.ledger.head();
    assert.ok(ledgerHead, "sealed execution must have a ledger head");
    assert(ledgerHead.sequence >= 5);
  });
});

test("silent, out-of-authority, and rollback-free actions cannot obtain a receipt", async () => {
  await withRuntime(async (runtime) => {
    const silent = decide({
      id: "decision.synthetic.silent",
      ...runtime.snapshot,
      intent: runtime.makeIntent({ id: "intent.synthetic.silent", request: null }),
      now: T1,
      expires_at: T2
    });
    const outside = decide({
      id: "decision.synthetic.outside",
      ...runtime.snapshot,
      intent: runtime.makeIntent({
        id: "intent.synthetic.outside",
        action: {
          adapter: "cint.adapter.synthetic-file-patch",
          type: "SYNTHETIC_FILE_PATCH",
          target: { path: "other.txt" },
          parameters: { content: "after\n", expected_before_sha256: runtime.beforeSha256 },
          consequence: "CONSEQUENTIAL"
        }
      }),
      now: T1,
      expires_at: T2
    });
    const noRollbackCapability = createAdapterCapability({
      id: "cint.adapter.synthetic-file-patch",
      action_types: ["SYNTHETIC_FILE_PATCH"],
      consequence_classes: ["CONSEQUENTIAL"],
      prepare_side_effect_free: true,
      rollback: false,
      interrupt: true,
      outcome_verification: true
    });
    const rollbackFree = decide({
      id: "decision.synthetic.no-rollback",
      ...runtime.snapshot,
      adapter_capability: noRollbackCapability,
      now: T1,
      expires_at: T2
    });
    assert.equal(silent.status, "DENY");
    assert.equal(outside.status, "DENY");
    assert.equal(rollbackFree.status, "DENY");
    for (const decision of [silent, outside, rollbackFree]) {
      assert.throws(
        () => issueUntrusted(runtime.receipt_authority, { decision, issued_at: T1 }),
        (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_DECISION_INELIGIBLE")
      );
    }
  });
});

test("changed action digest is rejected before execution", async () => {
  await withRuntime(async (runtime) => {
    const changed = runtime.makeIntent({ id: "intent.execution.changed", content: "different\n" });
    const result = await runtime.execute({
      snapshot_provider: async () => ({ ...runtime.snapshot, intent: changed })
    });
    assert.equal(result.status, "REJECTED");
    assert.equal(result.action_started, false);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("stale policy revokes the receipt before execution", async () => {
  await withRuntime(async (runtime) => {
    const changedPolicy = runtime.makePolicy({ version: "r0.2", epoch: 2, issued_at: T1 });
    const result = await runtime.execute({
      snapshot_provider: async () => ({ ...runtime.snapshot, policy: changedPolicy })
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("policy change after consumption still blocks the action", async () => {
  await withRuntime(async (runtime) => {
    const changedPolicy = runtime.makePolicy({ version: "r0.2", epoch: 2, issued_at: T1 });
    let calls = 0;
    const result = await runtime.execute({
      snapshot_provider: async () => {
        calls += 1;
        return calls === 1 ? runtime.snapshot : { ...runtime.snapshot, policy: changedPolicy };
      }
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "CONSUMED");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("receipt replay is rejected after a sealed action", async () => {
  await withRuntime(async (runtime) => {
    assert.equal((await runtime.execute()).status, "SEALED");
    const replay = await runtime.execute();
    assert.equal(replay.status, "REPLAY_REJECTED");
    assert.equal(replay.action_started, false);
  });
});

test("outcome divergence triggers rollback and restores the original hash", async () => {
  await withRuntime(async (runtime) => {
    const execute = runtime.adapter.execute.bind(runtime.adapter);
    runtime.adapter.execute = async (...args) => {
      const record = await execute(...args);
      await writeFile(runtime.target, "diverged\n", "utf8");
      return record;
    };
    const result = await runtime.execute();
    assert.equal(result.status, "ROLLED_BACK");
    assert.equal(result.outcome.status, "ROLLED_BACK");
    assert.equal(result.outcome.final_state_digest, runtime.beforeSha256);
    assert.equal(sha256(await readFile(runtime.target)), runtime.beforeSha256);
    runtime.seal_authority.verify(result.evidence_seal);
  });
});

test("in-flight interrupt triggers rollback and a sealed restored outcome", async () => {
  await withRuntime(async (runtime) => {
    const execute = runtime.adapter.execute.bind(runtime.adapter);
    runtime.adapter.execute = async (...args) => {
      await execute(...args);
      throw new CintError("CINT_EXECUTION_INTERRUPTED", "Synthetic interrupt");
    };
    const result = await runtime.execute();
    assert.equal(result.status, "ROLLED_BACK");
    assert.equal(result.error_code, "CINT_EXECUTION_INTERRUPTED");
    assert.equal(sha256(await readFile(runtime.target)), runtime.beforeSha256);
    runtime.seal_authority.verify(result.evidence_seal);
  });
});

test("unavailable CINT dependency fails closed without consuming or acting", async () => {
  await withRuntime(async (runtime) => {
    const result = await runtime.execute({ receipt_authority: null });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_UNAVAILABLE");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "PENDING");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("missing adapter verifier fails closed before receipt consumption", async () => {
  await withRuntime(async (runtime) => {
    const adapter = {
      id: runtime.adapter.id,
      capability: runtime.adapter.capability,
      prepare: runtime.adapter.prepare.bind(runtime.adapter),
      execute: runtime.adapter.execute.bind(runtime.adapter),
      rollback: runtime.adapter.rollback.bind(runtime.adapter)
    };
    const result = await runtime.execute({ adapter });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_UNAVAILABLE");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "PENDING");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("missing trusted clock fails closed before receipt consumption", async () => {
  await withRuntime(async (runtime) => {
    const result = await runtime.execute({ clock: null });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_UNAVAILABLE");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "PENDING");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("runtime adapter capability mismatch is rejected before preparation", async () => {
  await withRuntime(async (runtime) => {
    let prepareCalls = 0;
    const capability = createAdapterCapability({
      id: runtime.adapter.id,
      action_types: ["SYNTHETIC_FILE_PATCH"],
      consequence_classes: ["CONSEQUENTIAL"],
      prepare_side_effect_free: true,
      rollback: true,
      interrupt: false,
      outcome_verification: true
    });
    const adapter = adapterWithHooks(runtime, {
      capability,
      afterPrepare: () => {
        prepareCalls += 1;
      }
    });
    const result = await runtime.execute({ adapter });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_ADAPTER_MISMATCH");
    assert.equal(result.action_started, false);
    assert.equal(prepareCalls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("alien runtime adapter capability fails before receipt consumption", async () => {
  await withRuntime(async (runtime) => {
    const capability = rehashRecord(runtime.adapter.capability, {
      protocol: "not-cint/adapter-capability/999",
      forbidden_field: true
    });
    const adapter = {
      id: runtime.adapter.id,
      capability,
      prepare: runtime.adapter.prepare.bind(runtime.adapter),
      execute: runtime.adapter.execute.bind(runtime.adapter),
      verify: runtime.adapter.verify.bind(runtime.adapter),
      rollback: runtime.adapter.rollback.bind(runtime.adapter)
    };
    const result = await runtime.execute({ adapter });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_UNAVAILABLE");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "PENDING");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("revalidation rejects alien adapter capability and machine state protocols", async () => {
  await withRuntime(async (runtime) => {
    for (const [field, protocol] of [
      ["adapter_capability", "not-cint/adapter-capability/999"],
      ["machine_state", "not-cint/machine-state/999"]
    ] as const) {
      const record = rehashRecord(runtime.snapshot[field], { protocol, forbidden_field: true });
      const revalidation = revalidateReceipt({
        receipt: runtime.receipt,
        receipt_authority: runtime.receipt_authority,
        ...runtime.snapshot,
        [field]: record,
        now: T1
      });
      assert.equal(revalidation.status, "REJECTED", field);
      assert(revalidation.reason_codes.some((reason) => reason === "CINT_PROTOCOL_INVALID"), field);
    }
  });
});

test("alien machine state fails execution admission before action", async () => {
  await withRuntime(async (runtime) => {
    const machine_state = rehashRecord(runtime.machine_state, {
      protocol: "not-cint/machine-state/999",
      forbidden_field: true
    });
    const result = await runtime.execute({
      snapshot_provider: async () => ({ ...runtime.snapshot, machine_state })
    });
    assert.equal(result.status, "REJECTED");
    assert.equal(result.action_started, false);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "REJECTED");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("policy drift introduced during preparation is revalidated before execution", async () => {
  await withRuntime(async (runtime) => {
    let activeSnapshot: ExecutionSnapshot = runtime.snapshot;
    let snapshotCalls = 0;
    let executeCalls = 0;
    const adapter = adapterWithHooks(runtime, {
      afterPrepare: () => {
        activeSnapshot = {
          ...runtime.snapshot,
          policy: runtime.makePolicy({ version: "r0.2", epoch: 2, issued_at: T1 })
        };
      },
      beforeExecute: () => {
        executeCalls += 1;
      }
    });
    const result = await runtime.execute({
      adapter,
      snapshot_provider: async () => {
        snapshotCalls += 1;
        return activeSnapshot;
      }
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal(snapshotCalls, 3);
    assert.equal(executeCalls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("authority revocation introduced during preparation is revalidated before execution", async () => {
  await withRuntime(async (runtime) => {
    let activeSnapshot: ExecutionSnapshot = runtime.snapshot;
    let executeCalls = 0;
    const adapter = adapterWithHooks(runtime, {
      afterPrepare: () => {
        activeSnapshot = {
          ...runtime.snapshot,
          authority: revokeAuthority(runtime.authority, {
            revoked_at: T1,
            reason: "Execution authority withdrawn during preparation"
          })
        };
      },
      beforeExecute: () => {
        executeCalls += 1;
      }
    });
    const result = await runtime.execute({ adapter, snapshot_provider: async () => activeSnapshot });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal(executeCalls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("receipt expiry crossed during preparation prevents every action", async () => {
  await withRuntime(async (runtime) => {
    const counters = { execute_calls: 0 };
    const result = await runtime.execute({
      adapter: adapterAdvancingClock(runtime, T2, counters)
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.error_code, "CINT_RECEIPT_EXPIRED");
    assert.equal(result.completed_at, T2);
    assert.notEqual(result.revalidation_digest, null);
    if (result.revalidation_digest === null) throw new Error("revoked execution must bind revalidation");
    assert.match(result.revalidation_digest, /^[a-f0-9]{64}$/);
    assert.equal(result.action_started, false);
    assert.equal(counters.execute_calls, 0);
    assert.equal((await runtime.store.inspect(runtime.receipt.id)).state, "CONSUMED");
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("authority expiry crossed during preparation is evaluated at the final trusted time", async () => {
  await withRuntime(async (runtime) => {
    const counters = { execute_calls: 0 };
    const finalRevalidation = revalidateReceipt({
      receipt: runtime.receipt,
      receipt_authority: runtime.receipt_authority,
      ...runtime.snapshot,
      now: EXPIRY
    });
    assert(finalRevalidation.reason_codes.some((reason) => reason === "CINT_RECEIPT_EXPIRED"));
    assert(finalRevalidation.reason_codes.some((reason) => reason === "CINT_AUTHORITY_EXPIRED"));
    const result = await runtime.execute({
      adapter: adapterAdvancingClock(runtime, EXPIRY, counters)
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal(counters.execute_calls, 0);
    assert(result.error_code === "CINT_RECEIPT_EXPIRED" || result.error_code === "CINT_AUTHORITY_EXPIRED");
    assert.equal(result.revalidation_digest, finalRevalidation.digest);
    assert.equal(result.completed_at, EXPIRY);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("receipt lifetime is valid one millisecond before expiry and revoked at the exact boundary", async () => {
  await withRuntime(async (runtime) => {
    const result = await runtime.execute({
      adapter: adapterAdvancingClock(runtime, T2_BEFORE)
    });
    assert.equal(result.status, "SEALED");
    assert.equal(result.action_started, true);
    assert.equal(result.completed_at, T2_BEFORE);
    assert.equal(await readFile(runtime.target, "utf8"), "after\n");
  });
  await withRuntime(async (runtime) => {
    const counters = { execute_calls: 0 };
    const result = await runtime.execute({
      adapter: adapterAdvancingClock(runtime, T2, counters)
    });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.action_started, false);
    assert.equal(counters.execute_calls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("stale caller time cannot override an expired final trusted time", async () => {
  await withRuntime(async (runtime) => {
    runtime.clock.set(T2);
    let executeCalls = 0;
    const adapter = adapterWithHooks(runtime, {
      beforeExecute: () => {
        executeCalls += 1;
      }
    });
    const result = await runtime.execute({ adapter, at: T1 });
    assert.equal(result.status, "REVOKED");
    assert.equal(result.error_code, "CINT_RECEIPT_EXPIRED");
    assert.equal(result.action_started, false);
    assert.equal(executeCalls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("trusted clock failure after preparation fails closed without action", async () => {
  await withRuntime(async (runtime) => {
    let executeCalls = 0;
    const adapter = adapterWithHooks(runtime, {
      beforeExecute: () => {
        executeCalls += 1;
      }
    });
    const result = await runtime.execute({
      adapter,
      clock: { now: () => { throw new Error("clock unavailable"); } }
    });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_FAIL_CLOSED");
    assert.equal(result.action_started, false);
    assert.equal(executeCalls, 0);
    assert.equal(await readFile(runtime.target, "utf8"), "before\n");
  });
});

test("all thirteen public protocol schemas execute on valid and invalid runtime records", async () => {
  await withRuntime(async (runtime) => {
    const challenge = runCounterIntentChallenge({ ...runtime.snapshot, now: T1 });
    const revalidation = revalidateReceipt({
      receipt: runtime.receipt,
      receipt_authority: runtime.receipt_authority,
      ...runtime.snapshot,
      now: T1
    });
    const result = await runtime.execute();
    assert.equal(result.status, "SEALED");
    if (result.status !== "SEALED") throw new Error("schema fixture execution must seal");
    const records = [
      runtime.adapter.capability,
      runtime.authority,
      challenge,
      runtime.decision,
      result,
      runtime.snapshot.intent,
      runtime.machine_state,
      result.outcome,
      runtime.policy,
      runtime.principal,
      runtime.receipt,
      revalidation,
      result.evidence_seal
    ];
    assert.equal(CINT_SCHEMA_PROTOCOLS.length, 13);
    assert.deepEqual(
      new Set(records.map((record) => record.protocol)),
      new Set(CINT_SCHEMA_PROTOCOLS)
    );
    for (const record of records) {
      assert.equal(validateCintSchema(record).valid, true, record.protocol);
      const { digest, ...unsigned } = record;
      assert.throws(
        () => sealRecord({ ...unsigned, schema_forbidden_field: true }),
        (error: unknown) => hasErrorCode(error, "CINT_SCHEMA_INVALID"),
        record.protocol
      );
      const invalidUnsigned = { ...unsigned, schema_forbidden_field: true };
      const forgedInput = { ...invalidUnsigned, digest: canonicalDigest(invalidUnsigned) };
      assert.equal(validateCintSchema(forgedInput).valid, false, record.protocol);
      assert.throws(
        () => verifyProtocolRecord(forgedInput, record.protocol, "forged input"),
        (error: unknown) => hasErrorCode(error, "CINT_SCHEMA_INVALID"),
        record.protocol
      );
    }
  });
});

test("changed target bytes after decision fail closed before action", async () => {
  await withRuntime(async (runtime) => {
    await writeFile(runtime.target, "external-change\n", "utf8");
    const result = await runtime.execute();
    assert.equal(result.status, "FAIL_CLOSED");
    assert.equal(result.error_code, "CINT_TARGET_STATE_CHANGED");
    assert.equal(result.action_started, false);
    assert.equal(await readFile(runtime.target, "utf8"), "external-change\n");
  });
});
