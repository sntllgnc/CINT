#!/usr/bin/env node
import { main } from "../src/cint/cli.js";

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    protocol: "cint/error/1",
    code: error?.code ?? "CINT_INTERNAL_ERROR",
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
