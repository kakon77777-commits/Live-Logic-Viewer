# Execution Lifecycle Bridge Plan

**Goal:** Allow a validated managed-execution result to be explicitly recorded as `execution_completed` or `execution_failed` in the current Live Logic session without ever creating Evidence or modifying Judgment.

**Interaction contract:** Result inspection happens first. Recording requires an explicit user click and an existing claim. The generated event contains only controlled lifecycle metadata (job id + generated summary/reason), never raw stdout/stderr. Recording rebuilds a new validated immutable event store. The user can export the resulting session as canonical JSON.
