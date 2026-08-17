# Execution Request Nonce Plan

**Goal:** Add a client-generated request nonce to the canonical execution request so two identical source/limit submissions still have distinct request hashes. A stale response from an earlier identical execution must fail Viewer provenance verification.
