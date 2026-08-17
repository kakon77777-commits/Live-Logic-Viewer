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
- Remote execution remains disabled unless the same-origin capabilities document is exactly compatible with the Viewer contract.
- Remote execution result acceptance is ordered `closed schema → request/source provenance → detached signature`.
- If capabilities declare result signatures required, an unsigned response is rejected rather than downgraded to legacy behavior.
- The capability keyring is bounded and keyed by `key_id`; signatures from keys outside that trusted set are rejected.
- Viewer-side remote waits are independently bounded with `AbortController`; browser timeout is not treated as epistemic false.
- A short-lived access credential used by the MVP remote form is cleared from the input after submission and is not written to Web Storage.
- Downloaded execution-result JSON is the already-validated inert envelope; downloading does not promote it to Evidence.

### Control Plane trust domain

- v0.1 accepts Python only.
- `network_policy.mode` must be explicitly `deny`; provider defaults are not security policy.
- Source, wall time, and output have hard protocol ceilings.
- User source is written to a fixed sandbox file and is not interpolated into the fixed host command.
- Managed execution is one-job/one-sandbox and converges on full teardown.
- stdout/stderr is bounded while execution is running; overflow destroys the sandbox.
- wall-time expiration destroys the sandbox rather than merely disconnecting from a still-running process.
- Provider raw results must match the exact provider conformance contract before canonicalization; unknown fields or structured stdout/stderr fail closed.
- Production execution validates result-signing configuration before invoking a paid provider.
- Production result signing uses ECDSA P-256 / SHA-256. Only the active signing key has private material.
- `RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS` may contain only a bounded set of public verification keys for key-rotation grace; duplicate key IDs are rejected.
- `ALLOW_UNSIGNED_RESULTS_DEV=true` is an explicit development-only bypass. Production does not silently fall back to unsigned results.
- Production execution fails closed when the abuse-control binding is missing. `ALLOW_UNLIMITED_DEV=true` is a deliberate local-development bypass only.
- Rate limiting is abuse control, not an exact billing/quota ledger.
- Provider-specific runtime imports are kept out of the pure provider core tests.

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
