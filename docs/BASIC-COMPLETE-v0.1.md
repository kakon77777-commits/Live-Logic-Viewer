# Live Logic Viewer — Basic Complete v0.1

## Completed functional baseline

### Viewer
- strict event-package validation
- immutable store + deterministic projection
- Claim/Evidence/Judgment/Formula/Timeline rendering
- Play/Pause/Step/Live replay
- safe DOM / presentation-only KaTeX
- session JSON import/export
- execution result inspection
- capability handshake before remote execution
- explicit lifecycle recording only

### Control Plane
- strict Python-only request protocol
- per-run request nonce
- explicit network deny
- auth + exact origin checks
- rate-limit fail-closed gate
- source/runtime/output ceilings
- provider-neutral interface
- Cloudflare managed-sandbox adapter
- one-job/one-sandbox teardown
- streaming bounded output
- canonical result/provenance hashes
- public capabilities endpoint + OpenAPI

### Verification
- dependency-free Viewer core verifier
- dependency-free Control Plane core verifier
- Vitest suites
- Vite production build in CI
- source syntax CI
- pure Cloudflare provider core tests without requiring the Workers runtime loader

## Intentionally deferred to final/local calibration

- exact Cloudflare Wrangler/Container/Durable Object/Docker scaffold for the selected Sandbox SDK version
- production access/login UX
- production domain routing
- production rate threshold values
- actual Cloudflare account/billing binding
- live network-deny smoke test against a deployed Sandbox

## Post-basic roadmap

- signed result/event envelopes
- second provider adapter (Deno/Modal/E2B candidate)
- durable quota/billing ledger
- persistent live event stream / SSE
- stronger multi-model/evidence workflows
- public Bayesian Logic Judge product layer
