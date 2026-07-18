import { spawn } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, open, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { admitWorkerResult } from "./admission.js";
import { auditCodexEvents } from "./audit.js";
import { AgentFloorError } from "./errors.js";
import { createChildPacket, renderPacketPrompt, renderWorkerInstructions } from "./packet.js";
import { resolveInside, sha256, writeJsonAtomic } from "./util.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_SCHEMA = path.join(PROJECT_ROOT, "schemas", "worker-output.schema.json");
const TOOL_ITEM_TYPES = new Set([
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "web_search",
  "browser_action",
  "computer_action"
]);

const CODEX_PROCESS_ENV_ALLOWLIST = Object.freeze([
  "CODEX_HOME",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOGNAME",
  "PATH",
  "SHELL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER"
]);

function tomlString(value) {
  return JSON.stringify(String(value));
}

export class ExecutionGuard {
  constructor(limits) {
    this.limits = limits;
    this.toolItems = new Set();
    this.messageItems = new Set();
    this.turns = 0;
    this.cycles = 0;
    this.outputBytes = 0;
    this.violations = [];
  }

  violate(code, message, details = undefined) {
    if (!this.violations.some((item) => item.code === code)) {
      this.violations.push({ code, message, ...(details === undefined ? {} : { details }) });
    }
  }

  observe(event) {
    const item = event?.item;
    if (event?.type === "turn.started") {
      this.turns += 1;
      this.cycles += 1;
      if (this.cycles > this.limits.max_cycles) {
        this.violate("AF_CYCLE_LIMIT_EXCEEDED", "Worker exceeded the model/tool cycle limit", {
          actual: this.cycles,
          limit: this.limits.max_cycles
        });
      }
    }
    if ((event?.type === "item.started" || event?.type === "item.completed") && item && TOOL_ITEM_TYPES.has(item.type)) {
      const key = item.id ?? `${item.type}:${JSON.stringify(item)}`;
      if (!this.toolItems.has(key)) {
        this.toolItems.add(key);
        this.cycles += 1;
        if (this.cycles > this.limits.max_cycles) {
          this.violate("AF_CYCLE_LIMIT_EXCEEDED", "Worker exceeded the model/tool cycle limit", {
            actual: this.cycles,
            limit: this.limits.max_cycles
          });
        }
      }
    }
    if (event?.type === "item.completed" && item?.type === "agent_message") {
      const key = item.id ?? sha256(String(item.text ?? ""));
      if (!this.messageItems.has(key)) {
        this.messageItems.add(key);
        this.outputBytes += Buffer.byteLength(String(item.text ?? ""), "utf8");
        if (this.outputBytes > this.limits.max_output_bytes) {
          this.violate("AF_OUTPUT_LIMIT_EXCEEDED", "Worker exceeded the output byte limit", {
            actual: this.outputBytes,
            limit: this.limits.max_output_bytes
          });
        }
      }
    }
    return this.violations.length === 0;
  }
}

function pidIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireConcurrencySlot(spec) {
  const lockRoot = path.join(os.tmpdir(), "agent-floor-locks", sha256(spec.repository_boundary));
  await mkdir(lockRoot, { recursive: true });
  for (let slot = 1; slot <= spec.delegation.max_concurrency; slot += 1) {
    const slotPath = path.join(lockRoot, `slot-${slot}.lock`);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let handle = null;
      try {
        handle = await open(slotPath, "wx", 0o600);
        await handle.writeFile(`${JSON.stringify({
          pid: process.pid,
          worker: spec.worker.id,
          acquired_at: new Date().toISOString()
        })}\n`, "utf8");
        await handle.close();
        return {
          slot,
          release: async () => {
            try {
              await unlink(slotPath);
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
          }
        };
      } catch (error) {
        if (handle) await handle.close().catch(() => {});
        if (error.code !== "EEXIST") throw error;
        let owner = null;
        try {
          owner = JSON.parse(await readFile(slotPath, "utf8"));
        } catch {
          owner = null;
        }
        if (attempt === 0 && owner && !pidIsAlive(owner.pid)) {
          await unlink(slotPath).catch(() => {});
          continue;
        }
        break;
      }
    }
  }
  throw new AgentFloorError(
    "AF_CONCURRENCY_LIMIT",
    `All ${spec.delegation.max_concurrency} governed worker slots are occupied`
  );
}

export async function resolveCodexBinary(override = undefined) {
  const explicit = override ?? process.env.AGENT_FLOOR_CODEX_BIN;
  if (explicit) {
    const resolved = path.resolve(explicit);
    try {
      await access(resolved);
      return resolved;
    } catch (error) {
      throw new AgentFloorError("AF_CODEX_NOT_FOUND", `Codex executable not found: ${resolved}`, { cause: error.message }, 1);
    }
  }
  const appBinary = "/Applications/ChatGPT.app/Contents/Resources/codex";
  try {
    await access(appBinary);
    return appBinary;
  } catch {
    return "codex";
  }
}

export function buildChildProcessEnv(source = process.env) {
  const requested = String(source.AGENT_FLOOR_CODEX_ENV_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const names = new Set([...CODEX_PROCESS_ENV_ALLOWLIST, ...requested]);
  const env = { NO_COLOR: "1" };
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new AgentFloorError("AF_ENV_ALLOWLIST_INVALID", `Invalid environment variable name: ${name}`);
    }
    if (source[name] !== undefined) env[name] = String(source[name]);
  }
  return env;
}

export function buildCodexArgs(spec, runtimePaths) {
  return [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--json",
    "--skip-git-repo-check",
    "--disable",
    "multi_agent",
    "--disable",
    "enable_fanout",
    "--disable",
    "hooks",
    "--disable",
    "apps",
    "--disable",
    "plugins",
    "--disable",
    "memories",
    "--disable",
    "browser_use",
    "--disable",
    "computer_use",
    "--disable",
    "image_generation",
    "-C",
    runtimePaths.workspace,
    "-s",
    "read-only",
    "-m",
    spec.delegation.model,
    "-c",
    `model_reasoning_effort=${tomlString(spec.delegation.reasoning_effort)}`,
    "-c",
    "agents.max_threads=1",
    "-c",
    "agents.max_depth=0",
    "-c",
    "approval_policy=\"never\"",
    "-c",
    "allow_login_shell=false",
    "-c",
    "project_doc_max_bytes=0",
    "-c",
    "project_doc_fallback_filenames=[]",
    "-c",
    "shell_environment_policy.inherit=\"core\"",
    "-c",
    "shell_environment_policy.ignore_default_excludes=false",
    "-c",
    "shell_environment_policy.experimental_use_profile=false",
    "-c",
    "shell_environment_policy.exclude=[\"*KEY*\",\"*SECRET*\",\"*TOKEN*\",\"*PASSWORD*\",\"*CREDENTIAL*\",\"*AUTH*\"]",
    "-c",
    `model_instructions_file=${tomlString(runtimePaths.instructions)}`,
    "--output-schema",
    OUTPUT_SCHEMA,
    "-o",
    runtimePaths.output,
    "-"
  ];
}

async function createSourceProjection(spec, projectionRoot) {
  await mkdir(projectionRoot, { recursive: true });
  for (const relativePath of spec.worker.allowed_paths) {
    const source = await resolveInside(spec.repository_boundary, relativePath);
    const destination = path.join(projectionRoot, source.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source.absolute, destination);
  }
}

function extractLastAgentMessage(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "item.completed" && event?.item?.type === "agent_message") {
      return String(event.item.text ?? "");
    }
  }
  return null;
}

async function executeCodex({ command, args, cwd, prompt, guard, timeoutSeconds }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: buildChildProcessEnv()
      });
    } catch (error) {
      reject(new AgentFloorError("AF_CHILD_SPAWN_FAILED", `Could not start Codex: ${error.message}`, undefined, 1));
      return;
    }

    const events = [];
    const eventLines = [];
    let stdoutBuffer = "";
    let stderr = "";
    let eventBytes = 0;
    let terminated = false;
    let forceKillTimer = null;

    const terminate = () => {
      if (terminated) return;
      terminated = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
    };

    const processLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      eventBytes += Buffer.byteLength(line, "utf8") + 1;
      if (eventBytes > 16 * 1024 * 1024) {
        guard.violate("AF_EVENT_LOG_LIMIT_EXCEEDED", "Codex event stream exceeded 16 MiB");
        terminate();
        return;
      }
      let event;
      try {
        event = JSON.parse(line);
      } catch (error) {
        guard.violate("AF_CHILD_JSONL_INVALID", "Codex emitted malformed JSONL", { cause: error.message });
        terminate();
        return;
      }
      eventLines.push(line);
      events.push(event);
      if (!guard.observe(event)) terminate();
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      let newline;
      while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, newline);
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        processLine(line);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr, "utf8") < 128 * 1024) stderr += chunk;
    });
    child.on("error", (error) => {
      reject(new AgentFloorError("AF_CHILD_SPAWN_FAILED", `Codex process error: ${error.message}`, undefined, 1));
    });

    const timeout = setTimeout(() => {
      guard.violate("AF_RUNTIME_LIMIT_EXCEEDED", "Worker exceeded the wall-clock runtime limit", {
        limit_seconds: timeoutSeconds
      });
      terminate();
    }, timeoutSeconds * 1000);

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (stdoutBuffer.trim()) processLine(stdoutBuffer);
      resolve({
        exitCode: exitCode ?? 1,
        signal: signal ?? null,
        events,
        eventText: eventLines.length ? `${eventLines.join("\n")}\n` : "",
        stderr
      });
    });

    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

export async function runGovernedChild({ spec, outputDir, codexBinary = undefined }) {
  const out = path.resolve(outputDir);
  await mkdir(out, { recursive: true });
  const packetRecord = await createChildPacket(spec);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "agent-floor-run-"));
  const instructionsPath = path.join(temporary, "worker-instructions.md");
  const outputPath = path.join(temporary, "worker-output.json");
  const projectionPath = path.join(temporary, "authority-projection");
  await createSourceProjection(spec, projectionPath);
  await writeFile(instructionsPath, `${renderWorkerInstructions()}\n`, "utf8");
  const command = await resolveCodexBinary(codexBinary);
  const args = buildCodexArgs(spec, {
    instructions: instructionsPath,
    output: outputPath,
    workspace: projectionPath
  });
  const guard = new ExecutionGuard(spec.delegation);
  const slot = await acquireConcurrencySlot(spec);
  const startedAt = new Date().toISOString();
  let execution;
  try {
    execution = await executeCodex({
      command,
      args,
      cwd: projectionPath,
      prompt: renderPacketPrompt(packetRecord),
      guard,
      timeoutSeconds: spec.delegation.max_runtime_seconds
    });

    let outputText = null;
    try {
      outputText = await readFile(outputPath, "utf8");
    } catch {
      outputText = extractLastAgentMessage(execution.events);
    }
    let output = null;
    if (outputText) {
      try {
        output = JSON.parse(outputText);
      } catch (error) {
        guard.violate("AF_OUTPUT_JSON_INVALID", "Worker final output is not valid JSON", { cause: error.message });
      }
    } else {
      guard.violate("AF_OUTPUT_MISSING", "Worker did not produce a final output object");
    }
    const outputBytes = Buffer.byteLength(outputText ?? "", "utf8");
    if (outputBytes > spec.delegation.max_output_bytes) {
      guard.violate("AF_OUTPUT_LIMIT_EXCEEDED", "Worker final output exceeded the byte limit", {
        actual: outputBytes,
        limit: spec.delegation.max_output_bytes
      });
    }

    let audit = null;
    try {
      audit = auditCodexEvents(execution.events, { contextMode: "clean" });
    } catch (error) {
      guard.violate(error.code ?? "AF_USAGE_MISSING", error.message, error.details);
    }
    const admission = await admitWorkerResult({
      spec,
      packetRecord,
      audit,
      output,
      runtime: {
        exitCode: execution.exitCode,
        outputBytes,
        violations: guard.violations
      }
    });
    const finishedAt = new Date().toISOString();
    const runRecord = {
      protocol: "agent-floor/run/1",
      started_at: startedAt,
      finished_at: finishedAt,
      lineage: packetRecord.lineage,
      context_enforcement: {
        process_boundary: true,
        ephemeral: true,
        ignore_user_config: true,
        ignore_rules: true,
        project_docs_bytes: 0,
        inherited_turns: 0,
        multi_agent_tools: "disabled",
        child_spawn_depth: 0,
        process_environment: "allowlisted",
        shell_environment: "core-with-secret-pattern-exclusions"
      },
      authority: {
        repository_boundary: spec.repository_boundary,
        execution_projection: "run-local allowlisted copy",
        sandbox: "read-only",
        allowed_paths: spec.worker.allowed_paths
      },
      limits: spec.delegation,
      concurrency_slot: slot.slot,
      command: {
        executable: command,
        arguments: args.map((argument) => {
          if (argument === outputPath) return "<run-local-output>";
          if (argument === projectionPath) return "<run-local-authority-projection>";
          if (argument.includes(instructionsPath)) return "model_instructions_file=<run-local-instructions>";
          return argument;
        })
      },
      process: {
        exit_code: execution.exitCode,
        signal: execution.signal,
        cycles: guard.cycles,
        output_bytes: outputBytes
      },
      audit,
      admission
    };

    await writeJsonAtomic(path.join(out, "packet.json"), packetRecord);
    await writeFile(path.join(out, "events.jsonl"), execution.eventText, "utf8");
    await writeFile(path.join(out, "stderr.log"), execution.stderr, "utf8");
    if (output) await writeJsonAtomic(path.join(out, "worker-output.json"), output);
    await writeJsonAtomic(path.join(out, "admission.json"), admission);
    await writeJsonAtomic(path.join(out, "run.json"), runRecord);
    return runRecord;
  } finally {
    await slot.release();
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function inspectCodexSurface(codexBinary = undefined) {
  const command = await resolveCodexBinary(codexBinary);
  const run = (args) =>
    new Promise((resolve) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.on("error", (error) => resolve({ code: 1, stdout, stderr: error.message }));
    });
  const [version, help] = await Promise.all([run(["--version"]), run(["exec", "--help"])]);
  const requiredFlags = ["--ephemeral", "--ignore-user-config", "--ignore-rules", "--json", "--output-schema"];
  const flags = Object.fromEntries(requiredFlags.map((flag) => [flag, help.stdout.includes(flag)]));
  return {
    executable: command,
    version: version.stdout.trim() || version.stderr.trim(),
    exec_help_exit_code: help.code,
    required_flags: flags,
    result: version.code === 0 && help.code === 0 && Object.values(flags).every(Boolean) ? "READY" : "NOT_READY"
  };
}
