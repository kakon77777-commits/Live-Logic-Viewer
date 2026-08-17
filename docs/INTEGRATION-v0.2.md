# Live Logic Viewer — Integration v0.2

This document is the current integration-state record for the single consolidated branch `feat/integration-v0.2`. The original PR #1–#12 chain remains useful as layered history; new cross-cutting work lands on the integration branch.

## Current end-to-end path

```text
Validated Dynamic Logic events
→ immutable event store
→ deterministic projection/replay
→ safe DOM / KaTeX

Python source as data
→ same-origin capability handshake
→ short-lived bearer credential
→ Control Plane request validation
→ abuse-control gate
→ result-signing configuration gate
→ provider adapter
→ managed sandbox
→ bounded raw provider result
→ provider conformance validation
→ canonical execution result
→ SHA-256 request/source provenance
→ detached ECDSA P-256 / SHA-256 signature
→ Viewer schema validation
→ Viewer provenance verification
→ Viewer signature/keyring verification
→ inert Execution Result Inspector
→ optional explicit lifecycle event
```

## Viewer capabilities

- strict event-package schema and recursive forbidden-field validation;
- immutable store and deterministic replay;
- event-driven rendering; no event means no state motion;
- safe DOM text rendering and presentation-only KaTeX;
- local event-package import/export;
- execution-result import/inspection/export as a separate trust object;
- same-origin `/v1/capabilities` handshake before remote execution is enabled;
- bounded Viewer-side remote request wait with AbortController;
- fresh per-run `request_id` bound into the canonical request hash;
- remote acceptance order: schema → provenance → signature;
- active + bounded previous result-verification keyring;
- explicit `Record lifecycle` action only; no automatic Evidence/Judgment promotion.

## Control Plane capabilities

- Python-only request protocol;
- explicit network deny only;
- exact origin allowlist;
- bearer authorization gate;
- rate-limit abuse-control gate;
- fixed source/wall/output ceilings;
- one job / one managed sandbox lifecycle;
- fixed Python argv execution path;
- runtime stdout/stderr output budget;
- timeout/overflow convergence on sandbox destruction;
- exact provider raw-result contract;
- canonical result envelopes with request/source SHA-256 provenance;
- detached ECDSA P-256 / SHA-256 result signatures;
- active signing private key plus public-only rotation grace keyring;
- signing misconfiguration fails before provider execution;
- explicit unsigned development bypass only.

## Non-equivalences that remain architectural invariants

```text
Execution Result != Evidence
Execution Failure != Ω
Ω != provisionally_false
Replay != Re-execution
Hash provenance != Result truth
Signature validity != Result truth
Provider isolation != Risk elimination
```

A valid signature means only that the canonical envelope is intact relative to a trusted Control Plane signing key. It does not prove the executed code/model corresponds to reality.

## CI gates

Every pull-request head is expected to run:

1. Viewer dependency install, dependency-free core verification, Vitest suite, and Vite production build;
2. Control Plane dependency install, dependency-free core verification, and Vitest suite;
3. syntax parsing for all JavaScript modules;
4. exact-head source snapshot generation with per-file SHA-256 manifest.

Integration snapshots are named:

```text
Live-Logic-Viewer_Integration-v0.2_<commit-prefix>.zip
```

## Deployment-independent work still appropriate in this branch

The following may be completed without Cloudflare account access:

- protocol and conformance hardening;
- key rotation and integrity verification;
- import/export and diagnostics;
- deterministic replay/event semantics;
- provider-neutral contract helpers;
- CI/release snapshot quality;
- configuration validation;
- test vectors and negative fixtures;
- documentation/security review.

## Deployment-specific boundary intentionally not guessed

The following remain for the eventual local/account-bound calibration pass:

- current Cloudflare Sandbox Wrangler/Container/Durable Object scaffold;
- actual Cloudflare account bindings and secrets;
- production domain/route configuration;
- actual Workers Rate Limiting binding values;
- production identity/session provider;
- live sandbox egress-deny smoke test;
- deployed key/secret injection;
- provider billing/quota policy.

No integration code should invent these provider/account values merely to make the repository look deploy-complete.
