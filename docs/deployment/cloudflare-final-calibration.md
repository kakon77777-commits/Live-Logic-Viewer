# Cloudflare Final Deployment Calibration — Integration v0.2

This repository intentionally keeps account- and provider-version infrastructure out of the protocol core. Complete these steps on the final local checkout against the exact Cloudflare account, domain, and Sandbox SDK installed for deployment. Do not replace missing account facts with guessed defaults.

## 1. Verify the exact software state

Integration v0.2 is pinned to:

```text
Node.js 22.23.2
Viewer package-lock.json
Control Plane control-plane/package-lock.json
@cloudflare/sandbox 0.13.0-next.738.2
```

Run:

```bash
npm ci
npm run verify:core
npx vitest run tests
npm run build

cd control-plane
npm ci
npm run verify:core
npm test
```

Also confirm:

```bash
npm audit --audit-level=high
cd control-plane && npm audit --audit-level=high
```

Do not proceed with a red test, build, audit gate, or lockfile mismatch.

## 2. Verify commit and source snapshot

Before configuring infrastructure, verify that the local checkout matches the reviewed Git commit and source artifact:

```text
GITHUB_COMMIT.txt
FILE_MANIFEST.sha256
```

The final source ZIP digest and all per-file SHA-256 entries must pass. Do not calibrate a working tree that contains unreviewed local edits.

## 3. Generate the current official Sandbox scaffold

Use Cloudflare's official Sandbox/C3 template for the exact installed Sandbox SDK instead of copying an older Wrangler/Docker example.

Reconcile the generated scaffold with the repository contract:

- Worker entry: `control-plane/src/index.js`
- Sandbox class: `LiveLogicSandbox`
- Sandbox binding expected by code: `Sandbox`
- `LiveLogicSandbox.enableInternet = false`
- provider uses `getSandbox(..., { enableDefaultSession:false })`
- Python command uses a fixed `env -i` environment and fixed `/workspace/main.py`
- one job / one sandbox; every path converges on `destroy()`

Cloudflare Container class, Durable Object binding, migration, compatibility date, and Docker image must match the selected SDK/template. Verify them from current official Cloudflare documentation at calibration time.

## 4. Production variables / secrets

Configure server-side only:

```text
CONTROL_API_TOKEN
VIEWER_ORIGIN
RESULT_SIGNING_KEY_ID
RESULT_SIGNING_PUBLIC_JWK
RESULT_SIGNING_PRIVATE_JWK
EXECUTION_RATE_LIMITER
```

Optional planned key-rotation grace:

```text
RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS
```

Rules:

- `CONTROL_API_TOKEN` must contain at least 32 characters in the temporary MVP gate.
- `VIEWER_ORIGIN` must be the exact HTTPS production origin.
- public/private signing JWKs must be matching canonical EC P-256 keys.
- only the active signing key has private `d` material.
- previous rotation entries are public only and have unique `key_id` values.
- do not set `ALLOW_UNSIGNED_RESULTS_DEV=true` in production.
- do not set `ALLOW_UNLIMITED_DEV=true` in production.
- do not set `ALLOW_INSECURE_ORIGIN_DEV=true` in production.

No provider credential, Control Plane token, or signing private key belongs in Viewer JavaScript or static deployment variables exposed to the browser.

## 5. Same-origin routing

The Viewer intentionally calls only fixed same-origin paths:

```text
GET  /v1/capabilities
POST /v1/jobs
```

Operational probes:

```text
GET /health
GET /ready
```

`/health` means liveness only. `/ready` intentionally exposes only the minimal public `{ready, service}` result; detailed internal readiness checks remain server-side/test logic.

Deploy the static Viewer and Control Plane so `/v1/*` is same-origin from the browser. Do not modify the client to accept caller-supplied execution URLs.

## 6. Verify readiness before running code

Production `/ready` must return HTTP 200.

Internally, readiness requires:

- exact secure `VIEWER_ORIGIN`;
- configured temporary authorization token;
- rate-limit binding;
- valid result-signing configuration;
- valid provider binding/adapter.

A 200 `/health` with 503 `/ready` is **not** execution-ready.

## 7. Verify capability handshake

`/v1/capabilities` must validate to the narrow Viewer contract:

- runners: exactly `python`;
- network policies: exactly `deny`;
- `execution_result_is_evidence: false`;
- source/runtime/output ceilings no broader than Viewer contract;
- result-integrity algorithm exactly `ECDSA_P256_SHA256`;
- result signatures required in production;
- active P-256 public key present;
- bounded verification keyring contains active key and only approved previous public keys.

A broader, oversized, invalid-UTF-8, malformed, or inconsistent capabilities document must leave remote execution disabled.

## 8. Sandbox isolation smoke tests

Run at least:

1. `print(1 + 1)` → completed canonical result.
2. nonzero Python exit → failed execution result, not false Judgment.
3. endless loop → full sandbox teardown at wall-time deadline.
4. output flood → provider-side output budget triggers failed/truncated result and teardown.
5. outbound HTTP/DNS attempt → denied by Sandbox network policy.
6. environment inspection (`os.environ`) → no `CONTROL_API_TOKEN`, result-signing private JWK, Worker secret, or provider credential exposed.
7. child process / background process attempt → disappears when one-job sandbox is destroyed.
8. hostile stdout such as `<script>alert(1)</script>` → inert Inspector text.
9. oversized/invalid-UTF-8 HTTP request body → rejected before provider execution.

## 9. Result integrity smoke tests

Run one successful job and download its canonical result JSON.

Verify:

- `request_id` matches the submitted run;
- source/request SHA-256 provenance matches;
- `received_at <= completed_at`;
- signature payload version is v2;
- signing `key_id` is the active configured key;
- Viewer displays integrity as verified.

Then make local copies that change one field at a time:

- stdout;
- request id;
- received/completed time;
- source hash;
- signature bytes.

Every changed signed field must fail verification.

## 10. Signing-key rotation rehearsal

Before production traffic, rehearse:

1. active key A signs a result;
2. deploy key B as active while key A public material remains in `RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS`;
3. Viewer refreshes capabilities and verifies both old-A and new-B results;
4. Control Plane signs only with B;
5. remove A public key after the chosen grace window and confirm A becomes `present-unverified`/untrusted rather than silently accepted.

Never keep an old private signing key in the verification keyring.

## 11. Authentication / abuse-control calibration

The temporary bearer-entry mechanism is intentionally not the final multi-user identity design.

Before public multi-user release:

- replace or front it with the selected production identity/session system;
- ensure unauthorized attempts are also covered by the abuse-control gate;
- configure conservative Workers Rate Limiting values;
- confirm 429 behavior under repeated attempts;
- keep rate limiting separate from exact billing/quota accounting.

The Control Plane uses a non-prefix-short-circuit byte comparison for the temporary token, but a real identity/session provider is still preferred for public deployment.

## 12. Browser checks

Verify on the actual production origin:

- CSP contains no `unsafe-eval`;
- static response security headers are present;
- public Vite bundle contains no Control Plane secret markers or Sandbox SDK;
- no unexpected console errors;
- remote execution stays disabled when capability discovery fails;
- replay remains usable when the Control Plane is unavailable;
- access token is not written to localStorage/sessionStorage and the input clears after submission;
- oversized/invalid-UTF-8 event/result files are rejected;
- hostile imported strings stay inert text;
- execution result cannot alter Evidence/Judgment without explicit lifecycle recording;
- v0.1 and v0.2 event packages both replay;
- v0.2 wall-time labels do not reorder sequence history;
- Replay Fingerprint changes with event cursor and exports valid schema JSON;
- exported session JSON re-imports successfully.

## 13. Reproducibility check

Confirm the deployment is built with committed lockfiles and exact Node version. Preserve the CI dependency-tree artifacts for the deployed commit.

See:

```text
docs/REPRODUCIBILITY.md
```

## 14. Remaining post-basic extensions

These are **not** blockers for Integration v0.2 deployment calibration:

- production identity/session UX beyond the temporary bearer gate;
- exact durable paid quota/billing ledger;
- second managed-sandbox provider adapter;
- long-running/asynchronous job service;
- persistent/SSE live event service;
- broader execution languages or network policies;
- provider-specific deployment automation after the first verified manual calibration.
