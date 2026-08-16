# Security

## Security contract

- Input data is hostile by default.
- The Viewer never executes input-provided JavaScript, Python, shell, WebAssembly, HTML, or CSS.
- Provider credentials never belong in the browser.
- Raw managed-sandbox output must be canonicalized and schema validated before a future Viewer accepts it.
- Runtime event strings are rendered with DOM `textContent`; they are not inserted as raw HTML.
- Formula TeX is presentation-only and KaTeX is called with `trust: false`; input cannot supply KaTeX options or macros.
- Replay changes only an in-memory cursor and never means re-execution.
- `execution_failed`, `omega`, and `provisionally_false` are separate types/states.
- This MVP contains no managed-execution backend.

For a security report, provide the smallest reproducible event package and identify which invariant you believe it violates. Do not include production secrets.
