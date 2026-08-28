export * from "./admission.js";
export * from "./audit.js";
export * from "./packet.js";
export * from "./policy.js";
export * from "./runner.js";

export const CODEX_DELEGATION_ADAPTER = Object.freeze({
  id: "cint.adapter.codex-delegation",
  display_name: "CINT Adapter 01 — Delegated Coding-Agent Execution",
  legacy_protocols: Object.freeze([
    "agent-floor/1",
    "agent-floor/run/1",
    "agent-floor/admission/1"
  ]),
  authority_boundary: Object.freeze({
    may_mint_decision: false,
    may_issue_receipt: false,
    may_consume_receipt: false,
    may_self_admit: false,
    may_bypass_revalidation: false,
    may_seal_outcome: false
  })
});
