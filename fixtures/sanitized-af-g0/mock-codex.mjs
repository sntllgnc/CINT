#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const required = ["exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--json", "--output-schema"];
for (const value of required) {
  if (!args.includes(value)) throw new Error("missing governed argument: " + value);
}
const disabled = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--disable") disabled.push(args[i + 1]);
}
if (!disabled.includes("multi_agent")) throw new Error("multi_agent was not disabled");
if (!args.includes("agents.max_depth=0")) throw new Error("child spawn depth was not zero");
const instructionArg = args.find((value) => value.startsWith("model_instructions_file="));
if (!instructionArg) throw new Error("bounded instruction file was not supplied");
const instructionPath = JSON.parse(instructionArg.slice(instructionArg.indexOf("=") + 1));
if (!existsSync(instructionPath)) throw new Error("bounded instruction file does not exist");
const outputIndex = args.indexOf("-o");
const outputPath = args[outputIndex + 1];
const packet = JSON.parse(readFileSync(0, "utf8").split("\n\n").at(-1));
if (packet.context.mode !== "clean" || packet.context.inherited_turns !== 0) {
  throw new Error("packet was not clean");
}
const output = {
  "finding_code": "AUTHORITY_ALIASING",
  "status": "FOUND",
  "finding": "authority-aliasing flaw",
  "summary": "The v1 identifier is derived only from a normalized display name, so distinct authorities with collision-equivalent display names can resolve to the same identifier. The negative conformance vector requires deterministic rejection of that condition.",
  "evidence": [
    {
      "path": "contract.json",
      "line": 809,
      "excerpt": "\"authority_id\": \"digest:sha256(normalize(display_name))\"",
      "claim": "The v1 authority identifier is derived solely from the normalized display name."
    },
    {
      "path": "negative-conformance-vectors.json",
      "line": 10,
      "excerpt": "\"expected\": \"REJECT_COLLISION_EQUIVALENT_IDENTIFIER\"",
      "claim": "Collision-equivalent identifiers are required to be rejected."
    }
  ],
  "recommendation": "REJECT"
};
writeFileSync(outputPath, JSON.stringify(output) + "\n", "utf8");
const events = [
  { type: "thread.started" },
  { type: "turn.started" },
  { type: "item.completed", item: { id: "message-1", type: "agent_message", text: JSON.stringify(output) } },
  { type: "turn.completed", usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 100, reasoning_output_tokens: 20 } }
];
for (const event of events) process.stdout.write(JSON.stringify(event) + "\n");
