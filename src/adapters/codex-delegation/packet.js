import { readFile } from "node:fs/promises";
import path from "node:path";
import { AgentFloorError } from "../../errors.js";
import { FLOOR_LIMITS } from "./policy.js";
import { canonicalJson, resolveInside, sha256 } from "../../util.js";

export async function createChildPacket(spec) {
  const sourceManifest = [];
  for (const relativePath of spec.worker.allowed_paths) {
    const resolved = await resolveInside(spec.repository_boundary, relativePath);
    const bytes = await readFile(resolved.absolute);
    sourceManifest.push({
      path: resolved.relative,
      bytes: bytes.byteLength,
      sha256: sha256(bytes)
    });
  }

  const packet = {
    protocol: "agent-floor/1",
    root: {
      id: spec.root_task_id,
      task: spec.root_task
    },
    worker: {
      id: spec.worker.id,
      objective: spec.worker.objective
    },
    lineage: {
      parent: spec.root_task_id,
      child: spec.worker.id,
      depth: 1
    },
    context: {
      mode: "clean",
      fork_turns: "none",
      inherited_turns: 0
    },
    authority: {
      repository_boundary: ".",
      allowed_paths: spec.worker.allowed_paths,
      source_manifest: sourceManifest,
      filesystem: "read-only",
      network: "denied",
      delegation: "denied"
    },
    execution: {
      model: spec.delegation.model,
      reasoning_effort: spec.delegation.reasoning_effort,
      max_depth: spec.delegation.max_depth,
      max_concurrency: spec.delegation.max_concurrency,
      max_cycles: spec.delegation.max_cycles,
      max_runtime_seconds: spec.delegation.max_runtime_seconds,
      max_output_bytes: spec.delegation.max_output_bytes,
      max_incremental_tokens: spec.delegation.max_incremental_tokens
    },
    evidence_contract: {
      requirements: spec.worker.evidence_requirements,
      citation_shape: "repository-relative path + one-based line + exact excerpt + claim",
      admission_rule: "Only real in-boundary lines whose normalized text contains the excerpt can be admitted."
    },
    admission_policy: spec.admission,
    completion_contract: {
      format: "worker-output.schema.json",
      statuses: ["FOUND", "NO_FINDING", "BLOCKED"],
      stop: "Return one schema-valid JSON object, then stop."
    }
  };

  const serialized = canonicalJson(packet);
  const packetBytes = Buffer.byteLength(serialized, "utf8");
  if (packetBytes > FLOOR_LIMITS.packetBytes) {
    throw new AgentFloorError(
      "AF_PACKET_TOO_LARGE",
      `Child packet is ${packetBytes} bytes; hard limit is ${FLOOR_LIMITS.packetBytes}`,
      { packetBytes, limit: FLOOR_LIMITS.packetBytes }
    );
  }
  const packetSha256 = sha256(serialized);
  return {
    packet,
    packet_bytes: packetBytes,
    packet_sha256: packetSha256,
    lineage: {
      parent: spec.root_task_id,
      child: spec.worker.id,
      depth: 1,
      context_mode: "clean",
      packet_sha256: packetSha256
    }
  };
}

export function renderPacketPrompt(packetRecord) {
  return [
    "Execute only the bounded child packet below.",
    "Do not infer or request parent conversation history.",
    "Return only the JSON object required by the completion contract.",
    "",
    JSON.stringify(packetRecord.packet, null, 2)
  ].join("\n");
}

export function renderWorkerInstructions() {
  return [
    "# Agent Floor bounded worker",
    "",
    "You are one read-only child worker operating from a self-contained packet.",
    "The packet is the complete task context. No parent transcript exists or may be requested.",
    "Do not delegate, spawn agents, use network access, or read outside the declared repository boundary.",
    "Use only the allowed paths. Stop when the objective is answered or the evidence is insufficient.",
    "Every finding must cite a repository-relative file, a one-based line, an exact excerpt from that line, and a claim.",
    "Return exactly one JSON object matching the supplied output schema. Do not wrap it in Markdown."
  ].join("\n");
}
