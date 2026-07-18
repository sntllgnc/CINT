export class AgentFloorError extends Error {
  constructor(code, message, details = undefined, exitCode = 2) {
    super(message);
    this.name = "AgentFloorError";
    this.code = code;
    this.details = details;
    this.exitCode = exitCode;
  }
}

export function assertFloor(condition, code, message, details = undefined) {
  if (!condition) {
    throw new AgentFloorError(code, message, details);
  }
}

export function errorRecord(error) {
  return {
    result: "REJECTED",
    code: error?.code ?? "AF_INTERNAL_ERROR",
    message: error?.message ?? String(error),
    ...(error?.details === undefined ? {} : { details: error.details })
  };
}
