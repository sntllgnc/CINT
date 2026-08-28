import assert from "node:assert/strict";
import test from "node:test";

import { CINT_IDENTITY, main, renderCintHelp } from "../src/cint/cli.js";
import { parseJsonRecord } from "./cint-test-support.js";

test("CINT CLI reports integrated R1 source and unreleased package state", async () => {
  let output = "";
  assert.equal(await main(["identity"], { write: (value) => (output += value) }), 0);
  const identity = parseJsonRecord(output);
  assert.deepEqual(identity, CINT_IDENTITY);
  assert.equal(identity.public_display, "SI1 CINT");
  assert.equal(identity.source_state, "R1_INTEGRATED_INTO_MAIN");
  assert.equal(identity.release_state, "R1_UNRELEASED");
  assert.equal(identity.latest_public_release, "v0.1.0-cint-r0");
  assert.equal(identity.package_version, "0.1.0-cint-r0");
  assert.equal(identity.package_private, "YES");
  assert.equal(identity.production_ready, "NO");
  for (const removedField of [
    "public_source_exposure",
    "public_default_product",
    "public_release",
    "remaining_publication_authority"
  ]) {
    assert.equal(Object.hasOwn(identity, removedField), false);
  }
});

test("CINT CLI keeps legacy execution behind an explicit command", () => {
  const help = renderCintHelp();
  assert.match(help, /legacy <command>/);
  assert.match(help, /No consequential action without current authority/);
  assert.match(help, /current CINT source and release state/);
  assert.doesNotMatch(help, /frozen CINT-R0/);
});
