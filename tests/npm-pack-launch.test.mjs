import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_PACK_ARGUMENTS,
  npmPackInvocation,
  readNpmPackReport,
  spawnNpmPack
} from "../scripts/npm-pack-launch.mjs";

test("npm CLI metadata uses the current Node executable", () => {
  const invocation = npmPackInvocation({
    platform: "win32",
    execPath: "C:\\Node\\node.exe",
    npmExecPath: "C:\\Node\\node_modules\\npm\\bin\\npm-cli.js",
    commandProcessor: "C:\\Windows\\System32\\cmd.exe"
  });

  assert.deepEqual(invocation, {
    command: "C:\\Node\\node.exe",
    args: ["C:\\Node\\node_modules\\npm\\bin\\npm-cli.js", ...NPM_PACK_ARGUMENTS],
    mode: "NPM_CLI_PATH",
    shell: false
  });
});

test("Windows fallback uses a fixed command processor invocation", () => {
  const invocation = npmPackInvocation({
    platform: "win32",
    execPath: "C:\\Node\\node.exe",
    npmExecPath: undefined,
    commandProcessor: "C:\\Windows\\System32\\cmd.exe"
  });

  assert.deepEqual(invocation, {
    command: "C:\\Windows\\System32\\cmd.exe",
    args: ["/d", "/s", "/c", "npm.cmd pack --dry-run --json --ignore-scripts"],
    mode: "WINDOWS_COMMAND_PROCESSOR",
    shell: false
  });
});

test("POSIX fallback invokes npm without a shell", () => {
  const invocation = npmPackInvocation({
    platform: "linux",
    execPath: "/usr/bin/node",
    npmExecPath: undefined,
    commandProcessor: undefined
  });

  assert.deepEqual(invocation, {
    command: "npm",
    args: [...NPM_PACK_ARGUMENTS],
    mode: "POSIX_PATH",
    shell: false
  });
});

test("spawn errors are reported before status handling", () => {
  const launchError = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
  assert.throws(
    () => readNpmPackReport({ error: launchError, status: null, signal: null, stderr: "", stdout: "" }),
    /npm pack could not start \(ENOENT\): spawn ENOENT/u
  );
});

test("null status is reported as a distinct launch failure", () => {
  assert.throws(
    () => readNpmPackReport({ error: undefined, status: null, signal: "SIGTERM", stderr: "", stdout: "" }),
    /npm pack returned no exit status after signal SIGTERM/u
  );
});

test("successful JSON dry-run output is admitted unchanged", () => {
  let observed;
  const successful = {
    error: undefined,
    status: 0,
    signal: null,
    stderr: "",
    stdout: JSON.stringify([{ files: [{ path: "dist/src/cint/index.js" }] }])
  };
  const { invocation, result } = spawnNpmPack({
    cwd: "/candidate",
    platform: "linux",
    execPath: "/usr/bin/node",
    npmExecPath: "/usr/lib/node_modules/npm/bin/npm-cli.js",
    commandProcessor: undefined,
    spawn(command, args, options) {
      observed = { command, args, options };
      return successful;
    }
  });

  assert.equal(invocation.mode, "NPM_CLI_PATH");
  assert.deepEqual(observed, {
    command: "/usr/bin/node",
    args: ["/usr/lib/node_modules/npm/bin/npm-cli.js", ...NPM_PACK_ARGUMENTS],
    options: {
      cwd: "/candidate",
      encoding: "utf8",
      shell: false,
      windowsHide: true
    }
  });
  assert.deepEqual(readNpmPackReport(result), [{ files: [{ path: "dist/src/cint/index.js" }] }]);
});
