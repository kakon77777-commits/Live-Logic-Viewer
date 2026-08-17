# Live Logic Control Plane MVP Implementation Plan

**Goal:** Add a separate authenticated control-plane trust domain that validates execution requests, calls a provider adapter, and returns canonical execution envelopes without promoting execution output into Dynamic Logic evidence.

**Architecture:** Browser Viewer and Control Plane remain separate packages. v0.1 accepts Python only, requires explicit network deny, generates job IDs server-side, limits runtime/output, and uses an `ExecutionProvider` interface. The reference Cloudflare adapter uses a `LiveLogicSandbox` class with internet disabled and an ephemeral one-job-per-sandbox lifecycle.

**Verification:** `control-plane/scripts/verify-control-plane.mjs` exercises request validation, canonicalization, authentication, origin policy, mock execution, and network-deny fail-closed behavior without needing a Cloudflare account. Full Vitest and Cloudflare deploy/build validation are reserved for the final local calibration pass.
