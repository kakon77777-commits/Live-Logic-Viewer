# Cloudflare Final Deployment Calibration

This repository intentionally keeps provider-version infrastructure out of the protocol core. Complete these steps on the final local checkout using the current official Cloudflare Sandbox documentation and the exact SDK version selected for deployment.

## 1. Verify the software state

```bash
npm install
npm run verify:core
npx vitest run tests
npm run build

cd control-plane
npm install
npm run verify:core
npm test
```

Do not proceed with a red test/build.

## 2. Generate the current official Sandbox scaffold

Use Cloudflare's current official Sandbox/C3 template rather than copying an old Wrangler/Docker example from this repository. Reconcile the generated scaffold with:

- Worker entry: `control-plane/src/index.js`
- Sandbox class: `LiveLogicSandbox`
- Sandbox binding expected by code: `Sandbox`
- `LiveLogicSandbox.enableInternet = false`

Cloudflare's Sandbox docs require the Container class, Durable Object binding, migration, and Docker image to agree. The Docker image tag must match the installed Sandbox SDK version. Verify this from the current official docs/template during calibration.

## 3. Production variables / secrets

Set server-side only:

- `CONTROL_API_TOKEN` — temporary MVP access mechanism; replace/rotate for real users.
- `VIEWER_ORIGIN` — exact production Viewer origin.
- `EXECUTION_RATE_LIMITER` — Workers Rate Limiting binding.

Do **not** set `ALLOW_UNLIMITED_DEV=true` in production.

No provider credential is exposed to browser JavaScript.

## 4. Same-origin routing

The Viewer client intentionally calls only:

```text
GET  /v1/capabilities
POST /v1/jobs
```

Deploy/rout the static Viewer and Control Plane so these paths are same-origin from the browser's perspective. Do not modify the client to accept arbitrary execution URLs as a shortcut.

## 5. Verify production safety handshake

Before enabling the Run button, `/v1/capabilities` must validate to:

- runners: exactly `python`
- network policies: exactly `deny`
- `execution_result_is_evidence: false`
- source/runtime/output ceilings no broader than Viewer v0.1

A broader or malformed capabilities document must leave remote execution disabled.

## 6. Sandbox smoke tests

Run at least:

1. `print(1 + 1)` → completed result.
2. nonzero Python exit → failed execution result, not false Judgment.
3. endless loop → sandbox teardown at wall-time deadline.
4. output flood → output-limited failed/truncated result and teardown.
5. code attempting outbound network → denied by the Sandbox network policy.
6. hostile stdout such as `<script>alert(1)</script>` → inert Inspector text.
7. repeat identical source twice → different request nonce/hash; stale response rejected.

## 7. Rate-limit calibration

Workers Rate Limiting is a fast abuse-control layer, not precise billing accounting. Configure a conservative production threshold and independently design durable paid quota/accounting if needed later.

## 8. Final browser checks

- CSP has no `unsafe-eval`.
- no unexpected console errors.
- replay still works with remote execution unavailable.
- short-lived token is not present in localStorage/sessionStorage.
- execution result does not alter evidence/judgment until explicit lifecycle record.
- exported session JSON re-imports successfully.

## 9. Deferred after basic completion

Not blockers for the basic release:

- production identity/session UX replacing the temporary bearer-entry form;
- detached result signatures/public-key verification;
- exact durable quota/billing ledger;
- second managed-sandbox provider adapter;
- persistent/SSE live event service;
- provider-specific deployment automation after the first manual calibration.
