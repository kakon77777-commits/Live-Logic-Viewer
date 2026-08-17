# Control Plane Capabilities Handshake Plan

**Goal:** Keep remote execution disabled until the Viewer verifies a fixed same-origin control-plane capability document that is no broader than the Viewer v0.1 security contract.

**Fail-closed rules:** exactly one runner (`python`), exactly one network policy (`deny`), `execution_result_is_evidence=false`, and server resource ceilings no broader than the Viewer contract. `submitRemoteExecution()` repeats validation so direct client calls cannot bypass the UI handshake.
