#!/usr/bin/env node
import { main } from "../src/cint/cli.js";

function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    protocol: "cint/error/1",
    code: property(error, "code") ?? "CINT_INTERNAL_ERROR",
    message: property(error, "message") ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
