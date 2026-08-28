# CINT privacy model

CINT-R0 operates locally. Canonical receipts, consumption records, revalidation
records, ledger entries, outcomes, and seals contain identifiers, digests,
epochs, statuses, reason codes, timestamps, and aggregate adapter evidence. They
do not contain receipt keys, seal keys, absolute adapter paths, original
synthetic bytes, or complete Codex event streams.

## Sensitive local material

The embedding process controls:

- principal attributes and explicit request text;
- action parameters and target descriptions;
- receipt and seal keys;
- receipt-store and ledger locations;
- Codex task packets, allowlisted source content, model output, event JSONL,
  stderr, and evidence directories;
- any external policy or machine-state source used during revalidation.

These surfaces remain local unless the operator separately authorizes transfer.
Evidence seals prove digest relationships; they do not make the underlying
material safe to disclose.

## Adapter-specific boundaries

The synthetic adapter retains original bytes only in process memory long enough
to restore a failed or interrupted action. Execution and rollback records expose
hashes and byte counts, not content or absolute paths.

The Codex adapter inherits the Agent Floor privacy boundary: only allowlisted
files enter the temporary child projection, but the bounded packet and selected
source content may enter the configured model request. Raw native output remains
sensitive and is written only to the caller-selected local evidence directory.

## Public-tree controls

The repository publication audit rejects absolute local paths, common credential
formats, email addresses, session identifiers, hidden metadata, raw logs outside
the sanitized historical fixture, and non-public project names. Public material
uses only sanitized stage outcomes and local proof counts.
