# Live Logic Control Plane

This directory is a separate trust domain from the browser Viewer.

```text
Viewer request
→ strict request validation
→ authenticated control endpoint
→ rate-limit gate
→ signing configuration gate
→ ExecutionProvider
→ raw provider contract validation
→ managed sandbox
→ canonical execution envelope
→ detached result signature
```

## v0.2 security boundary

- only the `python` runner is accepted;
- `network_policy.mode` must be explicitly `deny`;
- source is capped at 64 KiB;
- execution wall time is capped at 10 seconds;
- combined output is capped at 64 KiB;
- browser origin is exact-match allowlisted through `VIEWER_ORIGIN`;
- `POST /v1/jobs` requires `Authorization: Bearer <CONTROL_API_TOKEN>`;
- job IDs are generated server-side;
- user source is written to a fixed file and never interpolated into a host command line;
- provider raw results must pass the exact provider contract before canonicalization;
- execution results are not automatically promoted to Dynamic Logic evidence;
- provider failures remain execution failures;
- production result signing is validated before provider execution begins.

## Provider architecture

Pure control-plane code depends only on the `ExecutionProvider` contract:

```text
executePython({ jobId, request })
→ {
    provider,
    stdout,
    stderr,
    exitCode,
    timedOut,
    outputLimited?
  }
```

Unknown fields, structured stdout/stderr, missing timeout state, or invalid primitive types fail closed before canonicalization.

The Cloudflare adapter uses the Sandbox SDK preview (`@cloudflare/sandbox@next`) and argv process execution. `LiveLogicSandbox.enableInternet = false` is fixed in code. User source controls file contents only; it does not control the host command line.

## Result integrity

Production environments require:

```text
RESULT_SIGNING_KEY_ID
RESULT_SIGNING_PUBLIC_JWK
RESULT_SIGNING_PRIVATE_JWK
```

The pair must be EC P-256 and public/private coordinates must match. The Control Plane signs the canonical execution envelope with ECDSA P-256 / SHA-256 after provider output validation and canonicalization.

Optional rotation grace keys:

```text
RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS
```

This is a JSON array containing at most four previous entries:

```json
[
  {
    "key_id": "previous-key",
    "public_jwk": {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "..."
    }
  }
]
```

Only the active key has private material. Duplicate key IDs fail closed. `GET /v1/capabilities` exposes the active public key plus the bounded verification keyring; it never exposes private material.

`ALLOW_UNSIGNED_RESULTS_DEV=true` is an explicit development/test-only mode. If production signing configuration is absent or inconsistent, `/v1/capabilities` and execution fail closed before calling the provider.

## Deployment boundary

This repository contains Worker-side logic and the Cloudflare adapter, but does not hard-code a Docker image or Wrangler Container/Durable Object binding. Generate and verify the current official Cloudflare Sandbox scaffold for the selected SDK version during local deployment calibration.

## Abuse-control binding

Production execution fails closed unless `EXECUTION_RATE_LIMITER` exposes Cloudflare's Workers Rate Limiting binding API. `ALLOW_UNLIMITED_DEV=true` is the only intentional bypass and is for local development/tests only.

The rate limiter is an abuse-control layer, not an accounting ledger; precise paid quotas require a separate durable accounting system.

## Public capabilities

`GET /v1/capabilities` exposes only fixed safety capabilities:

- Python-only runner;
- network deny only;
- source/runtime/output ceilings;
- `execution_result_is_evidence: false`;
- result-integrity algorithm, active key ID/public key, and bounded public verification keyring.

No bearer token, provider credential, private JWK, or sandbox secret is returned.
