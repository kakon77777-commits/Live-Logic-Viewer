# Security

## Security contract

### Viewer trust domain

- Input data is hostile by default.
- The Viewer never executes input-provided JavaScript, Python, shell, WebAssembly, HTML, or CSS.
- Provider credentials never belong in the browser.
- Runtime strings are rendered through safe DOM text APIs; event/result data is not inserted as raw HTML.
- Formula TeX is presentation-only and KaTeX uses `trust: false`; input cannot provide KaTeX options or macros.
- Replay changes only an in-memory cursor and never means re-execution.
- Imported and internally-derived event packages obey the same size/schema/forbidden-field limits.
- Remote execution remains disabled unless the same-origin capabilities document is exactly compatible with the Viewer v0.1 narrow contract.
- A short-lived access credential used by the MVP remote form is cleared from the input after submission and is not written to Web Storage.

### Control Plane trust domain

- v0.1 accepts Python only.
- `network_policy.mode` must be explicitly `deny`; provider defaults are not security policy.
- Source, wall time, and output have hard protocol ceilings.
- User source is written to a fixed sandbox file and is not interpolated into the fixed host command.
- Managed execution is one-job/one-sandbox and converges on full teardown.
- stdout/stderr is bounded while execution is running; overflow destroys the sandbox.
- wall-time expiration destroys the sandbox rather than merely disconnecting from a still-running process.
- Production execution fails closed when the abuse-control binding is missing. `ALLOW_UNLIMITED_DEV=true` is a deliberate local-development bypass only.
- Rate limiting is abuse control, not an exact billing/quota ledger.
- Provider-specific runtime imports are kept out of the pure provider core tests.

### Epistemic integrity

- `execution_failed`, `omega`, and `provisionally_false` are separate states/types.
- `Execution Result != Evidence`.
- Execution results enter the Inspector as a separate trust object.
- Timeline recording is explicit and may create only `execution_completed` / `execution_failed`; it never creates Evidence or changes Judgment.
- A fresh per-run `request_id` is part of the canonical request SHA-256 so stale identical-source responses fail provenance verification.

## Residual trust

Managed Sandbox isolation is an external trust dependency. Outsourcing execution transfers infrastructure risk; it does not eliminate it. The architecture therefore avoids granting the provider automatic access to the Viewer, local workstation, company network, or long-lived browser credentials.

## Reporting

For a security report, provide the smallest reproducible event/request/result package and identify which invariant you believe it violates. Never include production secrets.
