# CI Security Gates Plan

**Goal:** Run dependency-backed Viewer tests/build, Control Plane tests, and JavaScript syntax checks on GitHub without production secrets or managed-sandbox execution.

The CI intentionally uses no Cloudflare account credentials. Provider deployment remains a separate final calibration step.
