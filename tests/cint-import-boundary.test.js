import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const executeFile = promisify(execFile);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOADER = path.join(PROJECT_ROOT, "tests", "fixtures", "deny-cint-adapter-loader.mjs");

async function runDeniedImportProbe(arguments_) {
  return executeFile(process.execPath, ["--no-warnings", "--experimental-loader", LOADER, ...arguments_], {
    cwd: PROJECT_ROOT
  });
}

test("the supported CINT core entrypoint loads without Adapter 01", async () => {
  const core = pathToFileURL(path.join(PROJECT_ROOT, "src", "cint", "index.js")).href;
  await runDeniedImportProbe(["--input-type=module", "--eval", `await import(${JSON.stringify(core)})`]);
});

test("the identity CLI loads without Adapter 01 or the legacy CLI", async () => {
  const { stdout } = await runDeniedImportProbe([path.join(PROJECT_ROOT, "bin", "cint.js"), "identity"]);
  assert.equal(JSON.parse(stdout).product_code, "CINT");
});

test("the legacy CLI crosses the adapter boundary only when explicitly invoked", async () => {
  await assert.rejects(
    runDeniedImportProbe([path.join(PROJECT_ROOT, "bin", "cint.js"), "legacy", "doctor"]),
    (error) => error.stderr.includes("CINT_IMPORT_BOUNDARY")
  );
});
