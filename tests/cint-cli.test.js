import assert from "node:assert/strict";
import test from "node:test";

import { CINT_IDENTITY, main, renderCintHelp } from "../src/cint/cli.js";

test("CINT CLI reports public review exposure without default-product or release authority", async () => {
  let output = "";
  assert.equal(await main(["identity"], { write: (value) => (output += value) }), 0);
  const identity = JSON.parse(output);
  assert.deepEqual(identity, CINT_IDENTITY);
  assert.equal(identity.public_display, "SI1 CINT");
  assert.equal(identity.release_state, "REMOTE_R0_REVIEW_CANDIDATE");
  assert.equal(identity.public_source_exposure, "YES");
  assert.equal(identity.public_default_product, "NO");
  assert.equal(identity.public_release, "NO");
  assert.equal(identity.remaining_publication_authority, "NONE");
});

test("CINT CLI keeps legacy execution behind an explicit command", () => {
  const help = renderCintHelp();
  assert.match(help, /legacy <command>/);
  assert.match(help, /No consequential action without current authority/);
});
