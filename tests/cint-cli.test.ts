import assert from "node:assert/strict";
import test from "node:test";

import { CINT_IDENTITY, main, renderCintHelp } from "../src/cint/cli.js";
import { parseJsonRecord } from "./cint-test-support.js";

test("CINT CLI reports public review exposure without default-product or release authority", async () => {
  let output = "";
  assert.equal(await main(["identity"], { write: (value) => (output += value) }), 0);
  const identity = parseJsonRecord(output);
  assert.deepEqual(identity, CINT_IDENTITY);
  assert.equal(identity.public_display, "SI1 CINT");
  assert.equal(identity.release_state, "PUBLIC_R0_SOURCE");
  assert.equal(identity.public_source_exposure, "YES");
  assert.equal(identity.public_default_product, "YES");
  assert.equal(identity.public_release, "YES");
  assert.equal(identity.remaining_publication_authority, "SOURCE_RELEASE_COMPLETE");
});

test("CINT CLI keeps legacy execution behind an explicit command", () => {
  const help = renderCintHelp();
  assert.match(help, /legacy <command>/);
  assert.match(help, /No consequential action without current authority/);
});
