import assert from "node:assert/strict";
import test from "node:test";

import * as adapter from "../src/adapters/codex-delegation/index.js";
import * as admission from "../src/admission.js";
import * as audit from "../src/audit.js";
import * as packet from "../src/packet.js";
import * as policy from "../src/policy.js";
import * as runner from "../src/runner.js";

test("historical root exports are exact Adapter 01 compatibility aliases", () => {
  assert.equal(admission.admitWorkerResult, adapter.admitWorkerResult);
  assert.equal(audit.auditTraceFile, adapter.auditTraceFile);
  assert.equal(packet.createChildPacket, adapter.createChildPacket);
  assert.equal(policy.validateTaskSpec, adapter.validateTaskSpec);
  assert.equal(runner.runGovernedChild, adapter.runGovernedChild);
});

test("Adapter 01 declares a zero-authority CINT boundary", () => {
  assert.equal(adapter.CODEX_DELEGATION_ADAPTER.id, "cint.adapter.codex-delegation");
  assert.deepEqual(adapter.CODEX_DELEGATION_ADAPTER.authority_boundary, {
    may_mint_decision: false,
    may_issue_receipt: false,
    may_consume_receipt: false,
    may_self_admit: false,
    may_bypass_revalidation: false,
    may_seal_outcome: false
  });
});

