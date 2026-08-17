# Stacked Pull Request Map

The implementation was deliberately split by trust boundary so each layer can be reviewed independently.

1. **PR #1 — Secure Viewer MVP**  
   `main ← feat/secure-viewer-mvp`
2. **PR #2 — Control Plane MVP**  
   `feat/secure-viewer-mvp ← feat/control-plane-mvp`
3. **PR #3 — Execution Result Inspector**  
   `feat/control-plane-mvp ← feat/execution-result-viewer`
4. **PR #4 — Remote Execution Client**  
   `feat/execution-result-viewer ← feat/remote-execution-client`
5. **PR #5 — Provenance Integrity**  
   `feat/remote-execution-client ← feat/provenance-integrity`
6. **PR #6 — Rate Limit + Capabilities**  
   `feat/provenance-integrity ← feat/rate-limit-capabilities`
7. **PR #7 — CI Security Gates**  
   `feat/rate-limit-capabilities ← feat/ci-security-gates`
8. **PR #8 — Capabilities Handshake**  
   `feat/ci-security-gates ← feat/capabilities-handshake`
9. **PR #9 — Bounded Sandbox Output**  
   `feat/capabilities-handshake ← feat/bounded-sandbox-output`
10. **PR #10 — Request Nonce**  
    `feat/bounded-sandbox-output ← feat/request-nonce`
11. **PR #11 — Execution Lifecycle Bridge**  
    `feat/request-nonce ← feat/execution-lifecycle-bridge`

The Basic Complete documentation branch is stacked on PR #11.

## Merge/calibration note

Because this is a stacked series, review from the bottom up. After merging a lower layer, GitHub may require base retargeting/rebasing/closing already-contained child PRs. The final local calibration may instead squash the verified aggregate branch after confirming the complete tree and preserving this history document.
