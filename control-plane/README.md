# Live Logic Control Plane

This directory is a separate trust domain from the browser Viewer.

```text
Viewer request
→ strict request validation
→ authenticated control endpoint
→ ExecutionProvider
→ managed sandbox
→ canonical execution envelope
```

## v0.1 security boundary
- only the `python` runner is accepted;
- `network_policy.mode` must be explicitly `deny`;
- source is capped at 64 KiB;
- execution wall time is capped at 10 seconds;
- combined output is capped at 64 KiB;
- browser origin is exact-match allowlisted through `VIEWER_ORIGIN`;
- `POST /v1/jobs` requires `Authorization: Bearer <CONTROL_API_TOKEN>`;
- job IDs are generated server-side;
- user source is written to a fixed file and never interpolated into a host command line;
- execution results are not automatically promoted to Dynamic Logic evidence;
- provider failures remain execution failures.

## Provider architecture
Pure control-plane code depends only on the `ExecutionProvider` contract. The Cloudflare adapter uses the Sandbox SDK 1.0 preview (`@cloudflare/sandbox@next`) and argv process execution. `LiveLogicSandbox.enableInternet = false` is fixed in code.

## Deployment boundary
This snapshot contains Worker-side logic and the Cloudflare adapter, but does not hard-code a Docker image or Wrangler container binding. Generate/verify the current official Cloudflare Sandbox scaffold for the selected SDK version during local deployment calibration.

## Abuse-control binding
Production execution fails closed unless `EXECUTION_RATE_LIMITER` exposes Cloudflare's Workers Rate Limiting binding API. `ALLOW_UNLIMITED_DEV=true` is the only intentional bypass and is for local development/tests only.

The rate limiter is an abuse-control layer, not an accounting ledger; Cloudflare documents the binding as permissive/eventually consistent and location-local. Precise paid quotas must use a separate durable accounting system.

`GET /v1/capabilities` exposes only fixed public safety capabilities and never secrets.
