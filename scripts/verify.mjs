import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;

function npm(args, label) {
  const command = npmCli === undefined
    ? (process.platform === "win32" ? "npm.cmd" : "npm")
    : process.execPath;
  const commandArgs = npmCli === undefined ? args : [npmCli, ...args];
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false
  });
  assert.equal(result.status, 0, `${label} failed`);
}

const gates = [
  ["runtime:verify", "runtime support policy"],
  ["scan:escapes", "TypeScript escape-hatch scan"],
  ["scan:boundaries", "typed legacy import-boundary scan"],
  ["typecheck", "strict TypeScript typecheck"],
  ["build", "compiled build"],
  ["schema:verify", "runtime schema package verification"],
  ["test:cint", "compiled CINT tests"],
  ["test:legacy", "legacy tests"],
  ["demo", "AF-G0 deterministic demo"]
];

for (const [script, label] of gates) npm(["run", script], label);
npm(["audit"], "dependency audit");
for (const [script, label] of [
  ["public:audit", "publication audit"],
  ["evidence:verify", "evidence verification"],
  ["pack:verify", "package and export dry run"]
]) npm(["run", script], label);
