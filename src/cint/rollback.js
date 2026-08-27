import { sealRecord, verifySealedRecord } from "./canonical.js";

export async function performRollback(adapter, prepared, options) {
  try {
    const result = await adapter.rollback(prepared, options);
    verifySealedRecord(result, "rollback");
    return result;
  } catch (error) {
    return sealRecord({
      protocol: "cint/rollback-failure/1",
      status: "FAILED",
      error_code: error.code ?? "CINT_ROLLBACK_FAILED",
      rolled_back_at: options.at
    });
  }
}
