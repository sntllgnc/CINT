# CINT-R0 documentation and identity reassembly

## Active identity

```text
PRODUCT CODE       CINT
PUBLIC DISPLAY     SI1 CINT
DESCRIPTOR         Machine Counterintelligence Runtime
TAGLINE            No consequential action without current authority.
MISSION            Prevent silent or unauthorized intent from becoming machine action.
STATE              LOCAL_R0_CANDIDATE
PUBLICATION        NONE
```

The root README, package metadata, CLI identity, architecture, security model,
threat model, privacy model, limitations, release state, contribution guidance,
security policy, notice, changelog, and independent evaluation now describe
CINT rather than Agent Floor.

## Historical isolation

The following material is outside the active product surface:

- Agent Floor v0.1 README and architecture;
- historical security, privacy, limitation, release, and adoption documents;
- Build Week judge and independent-evaluation material;
- historical architecture and proof media.

They remain under `docs/archive/`. The immutable tag `v0.1.0-af-g0`, sanitized
fixtures, AF protocols, AF error codes, deterministic demo, and release evidence
remain available for Adapter 01 regression.

## Active operator surfaces

- `cint identity` reports the frozen R0 identity and publication authority
  `NONE`;
- `cint schemas` locates the strict CINT schema set;
- `cint legacy` makes compatibility use explicit;
- `agent-floor` remains the unchanged historical CLI;
- the package stays private and adds no publication or release action.

## Gate proof

- active Markdown links resolve;
- all threat-model source citations resolve to existing source lines;
- package and lock metadata agree on `si1-cint@0.1.0-cint-r0`;
- two CINT CLI tests pass;
- all 51 prior tests remain green;
- competition language and the historical accounting case no longer headline
  the active product;
- remote and external mutations remain zero.
