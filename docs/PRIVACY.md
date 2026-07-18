# Privacy model

## Deterministic demonstration

`npm run demo` uses sanitized local fixtures. It makes no model call, requires no Codex authentication, and reads no private repository.

## Live worker

A native run uses the locally installed Codex command and its configured provider. The bounded packet and allowlisted source content may enter model requests. Agent Floor does not automatically send the entire repository.

## Environment handling

The Codex process receives a small runtime allowlist rather than the complete parent environment. Worker shells retain default filtering and add exclusions for common secret-bearing names. Operators can explicitly extend the process allowlist; doing so transfers responsibility for those variables to the operator.

## Local run records

The selected output directory may contain packet text, source hashes, model event JSONL, stderr diagnostics, cited excerpts, worker conclusions, usage fields, command metadata, and timestamps. Agent Floor does not promise automatic redaction of native run records. Review them before sharing or archiving.

## Public evidence

The repository contains only synthetic source files, sanitized telemetry-shaped fixtures, and redacted summaries. It contains no authentication file, raw private rollout, local absolute path, private source repository, cookie, bearer token, API key, account email, or user biometric.
