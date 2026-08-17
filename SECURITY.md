# Security

## Security contract

### Viewer trust domain

- Input data is hostile by default.
- The Viewer never executes input-provided JavaScript, Python, shell, WebAssembly, HTML, or CSS.
- Provider credentials and result-signing private keys never belong in the browser.
- Runtime strings are rendered through safe DOM text APIs; event/result data is not inserted as raw HTML.
- Formula TeX is presentation-only and KaTeX uses `trust: false`; input cannot provide KaTeX options or macros.
- Replay changes only an in-memory cursor and never means re-execution.
- Imported and internally-derived event packages obey the same size/schema/forbidden-field limits.
- Built-in same-origin demo responses are streamed through the same bounded UTF-8 reader instead of being trusted as unlimited files.
- Remote execution remains disabled unless the same-origin capabilities document is exactly compatible with the Viewer contract.
- Capability responses and remote execution results are byte-bounded while streaming and use fatal UTF-8 decoding before JSON parsing.
- Remote execution result acceptance is ordered `closed schema → request/source provenance → detached signature`.
- If capabilities declare result signatures required, an unsigned response is rejected rather than downgraded to legacy behavior.
- The capability keyring is bounded and keyed by `key_id`; signatures from keys outside that trusted set are rejected.
- P-256 public JWK coordinates must use canonical 32-byte base64url encoding before WebCrypto is invoked.
- Unknown result-signing keys may cause one same-origin capability refresh. Actual signature verification failure never downgrades to `unverified`.
- Viewer-side remote waits are independently bounded with `AbortController`; browser timeout is not treated as epistemic false.
- The temporary bearer execution credential must contain at least 32 characters. It is cleared from the input after submission and is not written to Web Storage.
- Downloaded execution-result JSON is the already-validated inert envelope; downloading does not promote it to Evidence.
- The production Viewer bundle is scanned in CI for Control Plane secret/provider markers after the Vite build.

### Control Plane trust domain

- v0.1 execution requests accept Python only.
- `network_policy.mode` must be explicitly `deny`; provider defaults are not security policy.
- Source, wall time, output, and HTTP request-body sizes have hard protocol ceilings.
- Request bodies are bounded during streaming before JSON parsing; oversized declared/streamed bodies and invalid UTF-8 fail before provider execution.
- `CONTROL_API_TOKEN` must contain at least 32 characters for readiness/authentication. The token is temporary MVP authorization, not the final identity/session design.
- User source is written to a fixed sandbox file and is not interpolated into the fixed host command.
- The Cloudflare provider disables the default session and launches Python through a fixed `env -i` command with only a minimal PATH/HOME/locale/Python environment. Worker secrets are not intentionally inherited by the Python process.
- Managed execution is one-job/one-sandbox and converges on full teardown.
- stdout/stderr is bounded while execution is running; overflow destroys the sandbox.
- wall-time expiration destroys the sandbox rather than merely disconnecting from a still-running process.
- Provider raw results must match the exact provider conformance contract before canonicalization; unknown fields or structured stdout/stderr fail closed.
- Production execution validates result-signing configuration before invoking a paid provider.
- Production result signing uses ECDSA P-256 / SHA-256. Only the active signing key has private material.
- P-256 public coordinates and private scalar must use canonical 32-byte base64url encoding.
- `RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS` may contain only a bounded set of public verification keys for key-rotation grace; duplicate key IDs are rejected.
- `ALLOW_UNSIGNED_RESULTS_DEV=true` is an explicit development-only bypass. Production does not silently fall back to unsigned results.
- Production execution fails closed when the abuse-control binding is missing. `ALLOW_UNLIMITED_DEV=true` is a deliberate local-development bypass only.
- `/health` proves liveness only. `/ready` checks origin/auth/rate-limit/signing/provider configuration without launching a sandbox or consuming execution quota.
- Rate limiting is abuse control, not an exact billing/quota ledger.
- Provider-specific runtime imports are kept out of the pure provider core tests.

### Signed audit metadata

Result-signature payload v2 cryptographically covers:

- `job_id`;
- client `request_id`;
- Control Plane `received_at`;
- Control Plane `completed_at`;
- execution status/metadata;
- stdout/stderr/truncation state;
- source/request provenance hashes.

Prototype payload v1 remains verifiable for compatibility, but v1 envelopes are forbidden from carrying `request_id`, `received_at`, or `completed_at`, because those fields were not covered by the v1 signature. This prevents unsigned audit metadata from being displayed as if it were protected by a valid legacy signature.

### Dynamic Logic event time

Event package v0.1 remains sequence-only for backward compatibility.

Event package v0.2 adds canonical UTC `created_at` and per-event `occurred_at` fields. `sequence` remains the only replay ordering authority: wall-time metadata cannot reorder committed history. A v0.1 → v0.2 migration requires an explicit timestamp for every historical event and refuses to fabricate missing timestamps.

When a verified execution result is explicitly recorded into a v0.2 Dynamic Logic session, the lifecycle event may preserve request id, signed execution completion time, Viewer record time, verification status, and signing key id. Raw stdout/stderr is still excluded from the event package.

### Replay integrity and reproducibility

- Replay fingerprint JSON has a closed schema and versions its canonicalization, hash algorithm, projector, event schema, and cursor.
- `event_prefix_sha256` identifies the exact committed event prefix; `projection_sha256` identifies the deterministic state produced from that prefix.
- Fingerprints are audit/reproducibility objects, not truth proofs.
- Viewer and Control Plane direct dependencies are exact-version pinned and committed with npm lockfiles.
- CI uses exact Node `22.23.2`, `npm ci`, high-severity `npm audit`, dependency-tree artifacts, and SHA manifests.
- GitHub Actions are pinned to full immutable commit SHAs; regression tests reject mutable `actions/*@vN` tags.
- CI archives commit-matched source snapshots with per-file SHA-256 manifests.

### Epistemic integrity

- `execution_failed`, `omega`, and `provisionally_false` are separate states/types.
- `Execution Result != Evidence`.
- Execution results enter the Inspector as a separate trust object.
- A cryptographically valid execution result proves integrity relative to a trusted Control Plane signing key; it does **not** prove the result is epistemically true or promote it to Evidence.
- Timeline recording is explicit and may create only `execution_completed` / `execution_failed`; it never creates Evidence or changes Judgment.
- A fresh per-run `request_id` is part of the canonical request SHA-256 so stale identical-source responses fail provenance verification.

## Result signing and rotation

The Control Plane advertises an active public verification key and a bounded verification keyring. During a planned rotation:

1. deploy the new active private/public key pair;
2. keep the immediately previous public key in `RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS` for the desired grace period;
3. Viewer capability refresh trusts both IDs, while the Control Plane signs only with the active private key;
4. remove the old public key after all expected in-flight/archive verification windows expire.

A keyring entry never carries `d` private-key material. Key IDs are part of the signed envelope metadata selection path and cannot be silently substituted.

## Residual trust

Managed Sandbox isolation and the Control Plane deployment are external trust dependencies. Result signatures protect envelope authenticity/integrity relative to the configured signing key; they do not prove sandbox correctness, provider honesty, or the truth of the executed model. Outsourcing execution transfers infrastructure risk; it does not eliminate it.

The architecture therefore avoids granting the provider automatic access to the Viewer, local workstation, company network, or long-lived browser credentials.

## Reporting

For a security report, provide the smallest reproducible event/request/result package and identify which invariant you believe it violates. Never include production secrets or signing private keys.
