#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDirectory = path.join(root, "schemas", "cint");
const failures = [];

const build = spawnSync(process.execPath, [path.join(root, "scripts", "build.mjs")], {
  cwd: root,
  stdio: "inherit"
});
if (build.status !== 0) failures.push({ code: "TYPESCRIPT_BUILD_FAILED", status: build.status });

let CINT_SCHEMA_PROTOCOLS = [];
if (build.status === 0) {
  ({ CINT_SCHEMA_PROTOCOLS } = await import(pathToFileURL(path.join(root, "dist", "src", "cint", "schema.js")).href));
}

const directorySchemas = (await readdir(schemaDirectory))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const directoryProtocols = [];

for (const file of directorySchemas) {
  const schema = JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8"));
  const protocol = schema.properties?.protocol?.const;
  if (typeof protocol !== "string") {
    failures.push({ code: "SCHEMA_PROTOCOL_MISSING", file });
  } else {
    directoryProtocols.push(protocol);
  }
}

const registeredProtocols = [...CINT_SCHEMA_PROTOCOLS].sort();
directoryProtocols.sort();
if (directorySchemas.length !== 13) {
  failures.push({ code: "SCHEMA_DIRECTORY_COUNT", expected: 13, actual: directorySchemas.length });
}
if (registeredProtocols.length !== 13) {
  failures.push({ code: "SCHEMA_REGISTRY_COUNT", expected: 13, actual: registeredProtocols.length });
}
if (JSON.stringify(directoryProtocols) !== JSON.stringify(registeredProtocols)) {
  failures.push({ code: "SCHEMA_REGISTRY_MISMATCH" });
}

const npmCli = process.env.npm_execpath;
const pack = npmCli
  ? spawnSync(
      process.execPath,
      [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    )
  : spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        shell: process.platform === "win32"
      }
    );

let packagedSchemas = [];
if (pack.status !== 0) {
  failures.push({ code: "PACKAGE_DRY_RUN_FAILED", status: pack.status });
} else {
  try {
    const packageResult = JSON.parse(pack.stdout);
    packagedSchemas = (packageResult[0]?.files ?? [])
      .map(({ path: packagedPath }) => packagedPath)
      .filter((packagedPath) => packagedPath.startsWith("schemas/cint/") && packagedPath.endsWith(".schema.json"))
      .map((packagedPath) => path.posix.basename(packagedPath))
      .sort();
  } catch {
    failures.push({ code: "PACKAGE_DRY_RUN_INVALID_JSON" });
  }
}

if (JSON.stringify(packagedSchemas) !== JSON.stringify(directorySchemas)) {
  failures.push({
    code: "PACKAGED_SCHEMA_MISMATCH",
    expected: directorySchemas,
    actual: packagedSchemas
  });
}

const result = {
  gate: "CINT-SCHEMA-PACKAGE",
  verdict: failures.length === 0 ? "PASS" : "FAIL",
  registered_schemas: registeredProtocols.length,
  directory_schemas: directorySchemas.length,
  packaged_schemas: packagedSchemas.length,
  failures
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
