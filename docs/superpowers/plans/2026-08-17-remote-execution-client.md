# Remote Execution Client MVP

**Goal:** Complete a basic same-origin end-to-end path from Viewer source submission to the separate managed-execution control plane, while keeping provider credentials and execution out of the browser.

**Security constraints:** endpoint is fixed to `/v1/jobs`; network policy is hard-coded to deny; token is used for one request and not written to storage; canonical result validation runs before Inspector display; results never mutate Dynamic Logic evidence or judgments.
