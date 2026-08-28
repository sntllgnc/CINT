import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function run(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit"
  });
  assert.equal(result.status, 0, `${label} failed`);
}

async function copyMatching(source, destination, include) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyMatching(sourcePath, destinationPath, include);
    } else if (entry.isFile() && include(entry.name)) {
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
    }
  }
}

run([fileURLToPath(new URL("./clean.mjs", import.meta.url))], "clean");
run([
  fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
  "--project",
  "tsconfig.build.json"
], "TypeScript build");

await copyMatching(path.join(root, "src"), path.join(root, "dist", "src"), (name) => name.endsWith(".js"));
await copyMatching(path.join(root, "bin"), path.join(root, "dist", "bin"), (name) => name.endsWith(".js"));
await copyMatching(path.join(root, "schemas"), path.join(root, "dist", "schemas"), (name) => name.endsWith(".json"));

console.log(JSON.stringify({
  gate: "CINT-R1-BUILD",
  verdict: "PASS",
  output: "dist",
  staged_javascript_copy: true,
  schema_copy: true
}, null, 2));
