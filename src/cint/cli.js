import { main as legacyMain } from "../cli.js";
import { CintError } from "./canonical.js";

export const CINT_IDENTITY = Object.freeze({
  product_code: "CINT",
  public_display: "SI1 CINT",
  formal_descriptor: "Machine Counterintelligence Runtime",
  tagline: "No consequential action without current authority.",
  mission: "Prevent silent or unauthorized intent from becoming machine action.",
  invariant: "No consequential action without current decision-bound authority.",
  release_state: "LOCAL_R0_CANDIDATE",
  publication_authority: "NONE",
  adapters: Object.freeze([
    "cint.adapter.synthetic-file-patch",
    "cint.adapter.codex-delegation"
  ])
});

export function renderCintHelp() {
  return [
    "SI1 CINT — Machine Counterintelligence Runtime",
    "",
    "No consequential action without current authority.",
    "",
    "Commands:",
    "  identity           Print the frozen CINT-R0 identity and authority state",
    "  schemas            List strict CINT protocol schemas",
    "  legacy <command>   Invoke the preserved Agent Floor Adapter 01 CLI"
  ].join("\n");
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const write = options.write ?? ((value) => process.stdout.write(value));
  const [command = "help", ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    write(`${renderCintHelp()}\n`);
    return 0;
  }
  if (command === "identity") {
    write(`${JSON.stringify(CINT_IDENTITY, null, 2)}\n`);
    return 0;
  }
  if (command === "schemas") {
    write(`${JSON.stringify({ protocol: "cint/schema-index/1", directory: "schemas/cint", strict: true }, null, 2)}\n`);
    return 0;
  }
  if (command === "legacy") return legacyMain(rest);
  throw new CintError("CINT_CLI_COMMAND", `Unknown CINT command: ${command}`);
}
