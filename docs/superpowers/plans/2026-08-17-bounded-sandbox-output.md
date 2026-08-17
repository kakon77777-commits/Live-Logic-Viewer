# Bounded Sandbox Output Plan

**Goal:** Enforce output and wall-time limits while the managed program is still running, rather than collecting unbounded stdout/stderr and truncating only after execution.

**Implementation:** Cloudflare execution uses streaming callbacks with a combined UTF-8 output budget. Crossing the budget triggers full sandbox teardown. A Worker-side deadline also destroys the sandbox; the SDK timeout remains a secondary caller-side guard. Canonicalization marks overflow executions `failed` and `truncated` without converting them into any Dynamic Logic truth/judgment value.
