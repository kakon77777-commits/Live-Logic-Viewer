# Live Logic Viewer

A low-privilege browser viewer for Dynamic Logic event packages with a separate managed-execution control plane.

```text
Validated Event Package
→ Immutable Store
→ Deterministic Projection
→ Safe DOM / KaTeX
→ Replay

Viewer source request
→ capability handshake
→ same-origin Control Plane
→ Managed Sandbox Provider
→ canonical result + provenance
→ Execution Result Inspector
→ optional explicit lifecycle event
```

## Basic-complete architecture

The browser Viewer never executes user-provided code. Remote Python source is sent as data to a separate control plane. The control plane validates a narrow request contract, requires explicit outbound-network deny, applies abuse-control limits, and delegates execution to a managed sandbox provider.

Execution output returns as a canonical result envelope. The Viewer validates the envelope and verifies source/request provenance before displaying stdout/stderr as inert text. An execution result is **not Evidence** and cannot change Judgment automatically.

An inspected result may be recorded only through the explicit `Record lifecycle` action, which creates `execution_completed` or `execution_failed` metadata for an existing claim. Raw stdout/stderr is never copied into the Dynamic Logic event package.

## Security invariants

- Viewer has no shell, filesystem bridge, MCP, agent write tool, WebAssembly runner, `eval`, `new Function`, dynamic script URL, provider credential, or arbitrary HTML/CSS execution.
- Event/result packages are closed-schema validated and recursively reject capability-bearing fields.
- Replay changes only a cursor; replay is never re-execution.
- `ERROR != Ω != false`.
- `Execution Result != Evidence`.
- Remote execution stays disabled until `/v1/capabilities` proves the server is no broader than the Viewer v0.1 contract.
- Every remote run includes a fresh `request_id` in the canonical request hash.
- Provider-side stdout/stderr and wall time are bounded during execution; timeout/overflow destroys the sandbox.
- Production execution fails closed without the configured abuse-control binding.

## Viewer development

```bash
npm install
npm run verify:core
npx vitest run tests
npm run build
npm run dev
```

## Control Plane development

```bash
cd control-plane
npm install
npm run verify:core
npm test
```

The Cloudflare runtime adapter is deliberately thin. Pure provider behavior is tested through `cloudflare-core.js` without pretending a normal Node process is the Cloudflare Workers runtime.

## Deployment

Do not guess provider infrastructure defaults. Read `docs/deployment/cloudflare-final-calibration.md` and generate the current official Cloudflare Sandbox scaffold for the selected SDK version before production deployment.

## Documents

- `SECURITY.md`
- `docs/whitepapers/fully-outsourced-execution-v0.1.md`
- `docs/BASIC-COMPLETE-v0.1.md`
- `docs/deployment/cloudflare-final-calibration.md`
- `docs/STACKED-PRS.md`
