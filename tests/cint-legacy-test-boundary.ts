import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isPlainRecord } from "../src/cint/index.js";

export interface LegacyTaskSpec {
  readonly root_task: string;
  readonly delegation: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export async function loadLegacyTaskSpec(
  projectRoot: string,
  specPath: string
): Promise<LegacyTaskSpec> {
  const policyUrl = pathToFileURL(
    path.join(projectRoot, "src", "adapters", "codex-delegation", "policy.js")
  ).href;
  const legacyModule: unknown = await import(policyUrl);
  assert.ok(isPlainRecord(legacyModule), "legacy policy module must expose named exports");
  const loader = legacyModule["loadTaskSpec"];
  if (typeof loader !== "function") throw new Error("legacy policy module must expose loadTaskSpec");
  const loaded: unknown = await Reflect.apply(loader, undefined, [specPath]);
  assert.ok(isPlainRecord(loaded), "legacy task loader must return an object");
  const spec = loaded["spec"];
  assert.ok(isPlainRecord(spec), "legacy task loader must return a validated spec");
  const rootTask = spec["root_task"];
  const delegation = spec["delegation"];
  if (typeof rootTask !== "string") throw new Error("legacy spec root_task must be a string");
  assert.ok(isPlainRecord(delegation), "legacy spec delegation must be an object");
  return Object.freeze({
    ...spec,
    root_task: rootTask,
    delegation: Object.freeze({ ...delegation })
  });
}
