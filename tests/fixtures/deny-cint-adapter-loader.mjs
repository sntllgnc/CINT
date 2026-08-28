const DENIED_PATHS = [
  "/src/adapters/codex-delegation/",
  "/src/cint/adapters/codex/",
  "/src/cli.js"
];

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  if (DENIED_PATHS.some((denied) => resolved.url.includes(denied))) {
    throw new Error(`CINT_IMPORT_BOUNDARY: denied eager load of ${resolved.url}`);
  }
  return resolved;
}
