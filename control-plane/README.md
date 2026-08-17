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

Pure control-plane code depends only on the `ExecutionProvider` contract. The Cloudflare adapter uses the Sandbox SDK 1.0 preview (`@cloudflare/sandbox@next`) and `argv[]` process execution.

`LiveLogicSandbox.enableInternet = false` is fixed in code. v0.1 deliberately exposes no allowlist mode.

## Deployment boundary

This snapshot contains the Worker-side logic and Cloudflare adapter, but does not hard-code a Docker image or Wrangler container binding. For a deployment checkout, generate the current official Cloudflare Sandbox scaffold using the official C3/template for the installed SDK version, then bind its Durable Object / Container class to `LiveLogicSandbox`.

This is deliberate: Sandbox container images and Wrangler binding details are provider-version infrastructure and must be locally verified against the selected SDK release rather than silently guessed into the security baseline.

## Local core verification

The mock-provider path is dependency-light:

```bash
node scripts/verify-control-plane.mjs
```

Full tests after installing dependencies:

```bash
npm ci
npm test
```
