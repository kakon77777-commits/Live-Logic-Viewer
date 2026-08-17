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

- strict event/result schemas plus recursive forbidden-field validation;
- immutable store and deterministic replay;
- safe DOM text rendering and presentation-only KaTeX;
- event-driven motion; no event means no state motion;
- event package v0.1 backward compatibility;
- event package v0.2 with package `created_at` and per-event `occurred_at`;
- explicit v0.1 → v0.2 migration that refuses to invent missing historical timestamps;
- schema version and wall-time display in the timeline;
- execution-result import/inspection/download as a separate trust object;
- same-origin `/v1/capabilities` handshake before remote execution is enabled;
- bounded Viewer-side remote request wait with AbortController;
- fresh per-run `request_id` bound into the canonical request hash;
- remote acceptance order: schema → provenance → signature;
- active + bounded previous result-verification keyring;
- one capability refresh for planned key rotation without rerunning the sandbox;
- offline signed-result classification without confusing unavailable trust context with detected tampering;
- explicit `Record lifecycle` action only; no automatic Evidence/Judgment promotion;
- v0.2 lifecycle events can retain safe request/time/integrity provenance without copying stdout/stderr.

## Control Plane capabilities

- Python-only execution request protocol;
- explicit network deny only;
- exact origin allowlist;
- bearer authorization gate;
- rate-limit abuse-control gate;
- fixed source/wall/output ceilings;
- `/health` liveness and `/ready` configuration readiness split;
- one job / one managed sandbox lifecycle;
- fixed Python execution path;
- runtime stdout/stderr output budget;
- timeout/overflow convergence on sandbox destruction;
- exact provider raw-result contract;
- canonical result envelopes with request/source SHA-256 provenance;
- Control Plane `received_at` / `completed_at` audit timestamps;
- detached ECDSA P-256 / SHA-256 result signatures;
- signature payload v2 protects request id, audit time, execution output and provenance;
- prototype v1 signatures remain verifiable but cannot carry unsigned v2 audit fields;
- active signing private key plus public-only rotation grace keyring;
- signing misconfiguration fails before provider execution;
- explicit unsigned development bypass only;
- OpenAPI 3.1 contract aligned with readiness, capability keyring and canonical schemas.

## Non-equivalences that remain architectural invariants

```text
Execution Result != Evidence
Execution Failure != Ω
Ω != provisionally_false
Replay != Re-execution
Hash provenance != Result truth
Signature validity != Result truth
Provider isolation != Risk elimination
Sequence != Wall-time ordering
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
- result signing, rotation and integrity verification;
- event-time/replay semantics;
- import/export and diagnostics;
- provider-neutral contract helpers;
- CI/release snapshot quality;
- configuration validation and readiness reporting;
- test vectors and negative fixtures;
- documentation/security review.

## Deployment-specific boundary intentionally not guessed

The following remain for the eventual local/account-bound calibration pass:

- current Cloudflare Sandbox Wrangler/Container/Durable Object scaffold for the exact installed SDK release;
- actual Cloudflare account bindings and secrets;
- production domain/route configuration;
- actual Workers Rate Limiting binding values;
- production identity/session provider;
- live sandbox egress-deny, timeout, overflow and teardown smoke tests;
- deployed signing-key injection and real rotation rehearsal;
- provider billing/quota policy;
- final deployed-browser UX calibration.

Second-provider support, long-running asynchronous jobs, exact paid quota ledgers, and broader language/network policies are post-basic extensions rather than blockers for this integration baseline.

No integration code should invent provider/account values merely to make the repository look deploy-complete.
