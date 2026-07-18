# Security policy

## Supported release

Security fixes are applied to the latest `0.1.x` release line.

## Report a vulnerability

Use GitHub's private vulnerability reporting feature for this repository. Include the affected version, control boundary, reproduction steps, impact, and the smallest sanitized evidence needed to verify the report.

Do not place secrets, credentials, private source material, raw Codex logs, or operator conversation history in a public issue. If private reporting is unavailable, open a minimal public issue requesting a private coordination channel without including vulnerability details.

## Data and credential boundary

Agent Floor executes locally. It does not require raw log upload, does not modify Codex credentials, and does not publish authentication material. The runner uses the already authenticated local Codex command surface when a user explicitly invokes a native run.

The public repository contains sanitized fixtures only. Native proof is reduced to aggregate usage, control state, evidence references, and content hashes.

## Billing and quota boundary

Agent Floor reports request-local telemetry. Security reports and project documentation must not convert that telemetry into an unsupported billing total, subscription debit, or provider quota-causation claim.

## Disclosure handling

Reports will be acknowledged, reproduced against the smallest safe fixture, classified by affected boundary, and corrected with regression evidence. Coordinated disclosure should occur only after a fix or documented mitigation is available.
