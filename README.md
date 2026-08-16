# Live Logic Viewer

A low-privilege browser viewer for validated Dynamic Logic event packages.

```text
Validated Event Package
→ Immutable Store
→ Deterministic Projection
→ Safe DOM / KaTeX
→ Replay
```

## Security boundary

The Viewer never executes code supplied by event data. There is no shell, local filesystem bridge, MCP, agent tool, WebAssembly runner, dynamic script URL, provider credential, or arbitrary HTML/CSS input in this MVP. Managed execution is intentionally deferred to a separate control-plane/sandbox phase.

## Development

```bash
npm ci
npm test -- --run
npm run verify:core
npm run dev
npm run build
```

The built-in demo replays a judgment through omega → provisional support → omega/reopen → provisional oppose.

See `SECURITY.md` and `docs/whitepapers/fully-outsourced-execution-v0.1.md`.
