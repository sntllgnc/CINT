import { readFile } from "node:fs/promises";
import path from "node:path";
import { admitWorkerResult } from "./admission.js";
import { auditTraceFile } from "./audit.js";
import { runDemo, PROJECT_ROOT } from "./demo.js";
import { AgentFloorError, errorRecord } from "./errors.js";
import { createChildPacket } from "./packet.js";
import { loadTaskSpec } from "./policy.js";
import { inspectCodexSurface, runGovernedChild } from "./runner.js";
import { writeJsonAtomic } from "./util.js";

const HELP = `Agent Floor — bounded Codex child execution and evidence accounting

Usage:
  agent-floor demo [--out DIR]
  agent-floor packet TASK.json [--out FILE]
  agent-floor run TASK.json [--out DIR] [--codex PATH]
  agent-floor audit TRACE.jsonl [--kind codex|rollout] [--after ISO] [--worker ID]
  agent-floor admit TASK.json TRACE.jsonl RESULT.json [--kind codex|rollout]
  agent-floor doctor [--codex PATH]

The live runner always creates a new ephemeral process, ignores user configuration and
rules, replaces AGENTS.md with a bounded worker instruction file, disables multi-agent
tools, sets child spawn depth to zero, and runs in a read-only sandbox.`;

function parseArguments(argv) {
  const positional = [];
  const options = {};
  const valueFlags = new Set(["--out", "--codex", "--kind", "--after", "--worker"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (valueFlags.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new AgentFloorError("AF_CLI_ARGUMENT", `${argument} requires a value`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new AgentFloorError("AF_CLI_ARGUMENT", `Unknown option: ${argument}`);
    }
    positional.push(argument);
  }
  return { positional, options };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const command = argv[0] ?? "help";
    const { positional, options } = parseArguments(argv.slice(1));
    if (command === "help" || options.help) {
      process.stdout.write(`${HELP}\n`);
      return 0;
    }

    if (command === "demo") {
      const record = await runDemo({
        outputDir: options.out
          ? path.resolve(options.out)
          : path.join(PROJECT_ROOT, "artifacts", "generated")
      });
      printJson(record);
      return 0;
    }

    if (command === "packet") {
      if (positional.length !== 1) throw new AgentFloorError("AF_CLI_ARGUMENT", "packet requires one TASK.json path");
      const { spec } = await loadTaskSpec(positional[0]);
      const packet = await createChildPacket(spec);
      if (options.out) await writeJsonAtomic(path.resolve(options.out), packet);
      printJson(packet);
      return 0;
    }

    if (command === "run") {
      if (positional.length !== 1) throw new AgentFloorError("AF_CLI_ARGUMENT", "run requires one TASK.json path");
      const { spec } = await loadTaskSpec(positional[0]);
      const outputDir = options.out
        ? path.resolve(options.out)
        : path.resolve("artifacts", "runs", `${spec.worker.id}-${Date.now()}`);
      const record = await runGovernedChild({ spec, outputDir, codexBinary: options.codex });
      printJson(record);
      return record.admission.result === "ADMITTED" ? 0 : 1;
    }

    if (command === "audit") {
      if (positional.length !== 1) throw new AgentFloorError("AF_CLI_ARGUMENT", "audit requires one TRACE.jsonl path");
      const audit = await auditTraceFile(path.resolve(positional[0]), {
        kind: options.kind,
        after: options.after,
        worker: options.worker,
        contextMode: "clean"
      });
      printJson(audit);
      return 0;
    }

    if (command === "admit") {
      if (positional.length !== 3) {
        throw new AgentFloorError("AF_CLI_ARGUMENT", "admit requires TASK.json TRACE.jsonl RESULT.json");
      }
      const { spec } = await loadTaskSpec(positional[0]);
      const packetRecord = await createChildPacket(spec);
      const audit = await auditTraceFile(path.resolve(positional[1]), {
        kind: options.kind,
        contextMode: options.kind === "rollout" ? undefined : "clean",
        worker: options.worker ?? spec.worker.id,
        after: options.after
      });
      const outputText = await readFile(path.resolve(positional[2]), "utf8");
      const output = JSON.parse(outputText);
      const admission = await admitWorkerResult({
        spec,
        packetRecord,
        audit,
        output,
        runtime: { exitCode: 0, outputBytes: Buffer.byteLength(outputText, "utf8"), violations: [] }
      });
      if (options.out) await writeJsonAtomic(path.resolve(options.out), admission);
      printJson(admission);
      return admission.result === "ADMITTED" ? 0 : 1;
    }

    if (command === "doctor") {
      if (positional.length !== 0) throw new AgentFloorError("AF_CLI_ARGUMENT", "doctor takes no positional arguments");
      const record = await inspectCodexSurface(options.codex);
      printJson(record);
      return record.result === "READY" ? 0 : 1;
    }

    throw new AgentFloorError("AF_CLI_COMMAND", `Unknown command: ${command}`);
  } catch (error) {
    const record = errorRecord(error);
    process.stderr.write(`${JSON.stringify(record, null, 2)}\n`);
    return error?.exitCode ?? 1;
  }
}
