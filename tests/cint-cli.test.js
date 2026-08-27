import assert from "node:assert/strict";
import test from "node:test";

import { CINT_IDENTITY, main, renderCintHelp } from "../src/cint/cli.js";

test("CINT CLI exposes the frozen product identity and no publication authority", async () => {
  let output = "";
  assert.equal(await main(["identity"], { write: (value) => (output += value) }), 0);
  const identity = JSON.parse(output);
  assert.deepEqual(identity, CINT_IDENTITY);
  assert.equal(identity.public_display, "SI1 CINT");
  assert.equal(identity.publication_authority, "NONE");
});

test("CINT CLI keeps legacy execution behind an explicit command", () => {
  const help = renderCintHelp();
  assert.match(help, /legacy <command>/);
  assert.match(help, /No consequential action without current authority/);
});
