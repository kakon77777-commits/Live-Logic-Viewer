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
→ canonical result + provenance + detached signature
→ Viewer schema/provenance/signature verification
→ Execution Result Inspector
→ optional explicit lifecycle event
```

## Integration v0.2 architecture

The browser Viewer never executes user-provided code. Remote Python source is sent as data to a separate control plane. The control plane validates a narrow request contract, requires explicit outbound-network deny, applies abuse-control limits, and delegates execution to a managed sandbox provider.

Execution output returns as a canonical result envelope. The Viewer validates its closed schema, verifies the source/request provenance hashes, and—when the capability contract requires it—verifies a detached ECDSA P-256 / SHA-256 signature before accepting the remote result. Signing private keys exist only in the Control Plane environment. The Viewer receives public verification keys through the same-origin capability handshake.

Result-signature payload v2 additionally protects the client `request_id` and Control Plane `received_at` / `completed_at` audit timestamps. Legacy prototype v1 signatures remain verifiable, but v1 envelopes are forbidden from carrying these unsigned audit fields.

The result-integrity capability supports one active signing key plus a bounded set of previous public verification keys. This lets a deployment rotate its active private key without making in-flight or recently archived signed results unverifiable during a controlled grace period. Unknown-key results may trigger one capability refresh; actual signature failures never silently downgrade to unverified data.

An execution result is **not Evidence** and cannot change Judgment automatically. An inspected result may be recorded only through the explicit `Record lifecycle` action, which creates `execution_completed` or `execution_failed` metadata for an existing claim. Raw stdout/stderr is never copied into the Dynamic Logic event package.

## Event package versions

### v0.1

Legacy event packages use strictly increasing `sequence` as their replay history and contain no first-class wall-time metadata.

### v0.2

Timestamped event packages add:

- package `created_at`;
- required per-event `occurred_at`;
- canonical UTC timestamp validation;
- wall-time display in the Viewer timeline;
- explicit execution-lifecycle provenance fields such as `request_id`, execution completion time, record time, integrity status, and signing key id.

`sequence` remains the canonical replay ordering. `occurred_at` is evidence about wall time and **never reorders history**. A v0.1 → v0.2 migration helper requires an explicit timestamp for every historical event and refuses to invent missing times.

## Security invariants

- Viewer has no shell, filesystem bridge, MCP, agent write tool, WebAssembly runner, `eval`, `new Function`, dynamic script URL, provider credential, private signing key, or arbitrary HTML/CSS execution.
- Event/result packages are closed-schema validated and recursively reject capability-bearing fields.
- Replay changes only a cursor; replay is never re-execution.
- `ERROR != Ω != false`.
- `Execution Result != Evidence`.
- Remote execution stays disabled until `/v1/capabilities` proves the server is no broader than the Viewer contract.
- `/health` means liveness only; `/ready` checks required origin/auth/abuse-control/signing/provider configuration without launching a sandbox.
- Every remote run includes a fresh `request_id` in the canonical request hash.
- Remote acceptance order is `Schema → Provenance → Signature`.
- Required result signatures cannot be downgraded to unsigned results.
- Provider raw output must pass an exact conformance contract before canonicalization.
- Provider-side stdout/stderr and wall time are bounded during execution; timeout/overflow destroys the sandbox.
- Viewer-side remote waits are independently bounded and abort rather than spin forever.
- Production execution fails closed without abuse-control and result-signing configuration. Unsigned results require the explicit `ALLOW_UNSIGNED_RESULTS_DEV=true` development bypass.

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

The Cloudflare runtime adapter is deliberately thin. Pure provider behavior is tested through provider-core/conformance tests without pretending a normal Node process is the Cloudflare Workers runtime.

## Result signing configuration

Production Control Plane configuration requires:

```text
RESULT_SIGNING_KEY_ID
RESULT_SIGNING_PUBLIC_JWK
RESULT_SIGNING_PRIVATE_JWK
```

Optional key-rotation grace verification keys are supplied as a JSON array through:

```text
RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS
```

Each previous entry has the shape:

```json
{
  "key_id": "previous-key-id",
  "public_jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
```

Only the active key has a private component. `ALLOW_UNSIGNED_RESULTS_DEV=true` is a development-only escape hatch and is intentionally fail-closed unless explicitly configured.

## Deployment

Do not guess provider infrastructure defaults. Read `docs/deployment/cloudflare-final-calibration.md` and generate the current official Cloudflare Sandbox scaffold for the selected SDK version before production deployment.

## Documents

- `SECURITY.md`
- `docs/whitepapers/fully-outsourced-execution-v0.1.md`
- `docs/BASIC-COMPLETE-v0.1.md`
- `docs/INTEGRATION-v0.2.md`
- `docs/deployment/cloudflare-final-calibration.md`
- `docs/STACKED-PRS.md`
