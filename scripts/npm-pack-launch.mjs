import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export const NPM_PACK_ARGUMENTS = Object.freeze([
  "pack",
  "--dry-run",
  "--json",
  "--ignore-scripts"
]);

const WINDOWS_NPM_PACK_COMMAND = `npm.cmd ${NPM_PACK_ARGUMENTS.join(" ")}`;

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

export function npmPackInvocation(options = {}) {
  const platform = Object.hasOwn(options, "platform") ? options.platform : process.platform;
  const execPath = Object.hasOwn(options, "execPath") ? options.execPath : process.execPath;
  const npmExecPath = Object.hasOwn(options, "npmExecPath")
    ? options.npmExecPath
    : process.env.npm_execpath;
  const commandProcessor = Object.hasOwn(options, "commandProcessor")
    ? options.commandProcessor
    : process.env.ComSpec;
  if (nonEmpty(npmExecPath)) {
    return {
      command: execPath,
      args: [npmExecPath, ...NPM_PACK_ARGUMENTS],
      mode: "NPM_CLI_PATH",
      shell: false
    };
  }

  if (platform === "win32") {
    return {
      command: nonEmpty(commandProcessor) ? commandProcessor : "cmd.exe",
      args: ["/d", "/s", "/c", WINDOWS_NPM_PACK_COMMAND],
      mode: "WINDOWS_COMMAND_PROCESSOR",
      shell: false
    };
  }

  return {
    command: "npm",
    args: [...NPM_PACK_ARGUMENTS],
    mode: "POSIX_PATH",
    shell: false
  };
}

export function spawnNpmPack({ cwd, spawn = spawnSync, ...options }) {
  const invocation = npmPackInvocation(options);
  const result = spawn(invocation.command, invocation.args, {
    cwd,
    encoding: "utf8",
    shell: invocation.shell,
    windowsHide: true
  });
  return { invocation, result };
}

export function readNpmPackReport(result) {
  if (result.error !== undefined) {
    const code = nonEmpty(result.error.code) ? ` (${result.error.code})` : "";
    throw new Error(`npm pack could not start${code}: ${result.error.message}`, {
      cause: result.error
    });
  }

  if (result.status === null) {
    const signal = nonEmpty(result.signal) ? ` after signal ${result.signal}` : "";
    throw new Error(`npm pack returned no exit status${signal}`);
  }

  assert.equal(result.status, 0, result.stderr || "npm pack dry run failed");
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report) && report.length === 1, "unexpected npm pack report");
  assert.ok(Array.isArray(report[0].files), "npm pack report is missing its file inventory");
  return report;
}
