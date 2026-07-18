# Independent Codex evaluation

After cloning the public release, give a fresh Codex task this bounded packet:

```text
READ-ONLY EVALUATION

Target: https://github.com/sntllgnc/agent-floor
Revision: v0.1.0-af-g0

Inspect only the public repository. Do not use private account history, run
the optional native worker, modify files, or publish results externally.

1. Read README.md, docs/JUDGE-GUIDE.md, docs/ARCHITECTURE.md,
   docs/THREAT-MODEL.md, docs/PRIVACY.md, and SECURITY.md.
2. Run npm ci and npm test. Require 14 passing tests and zero failures.
3. Run npm run demo. Require AF-G0 PASS, 555,300,000 raw cumulative
   tokens, 1,492,621 request-local tokens, 372.03x correction,
   full-history REJECTED, evidence ADMITTED, and the contradictory
   semantic control REJECTED.
4. Run the invalid packet command from docs/JUDGE-GUIDE.md and require
   AF_CONTEXT_FULL_HISTORY_FORBIDDEN before worker execution.
5. Run npm run doctor only if a local Codex command is installed. Doctor
   makes no model call; Codex absence is not a deterministic-demo failure.
6. Audit public claims against source and evidence. Preserve the non-claims:
   no billing reconstruction and no hostile-code containment.

Return exactly:
- PASS, FAIL, or BLOCKED;
- command evidence;
- any claim/evidence mismatch with file and line;
- no more than 500 words.
```

This evaluator tests the frozen public object, not account memory or the build task.
