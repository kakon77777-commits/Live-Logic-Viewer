# Live Logic Viewer Secure Viewer MVP Implementation Plan

**Goal:** Build a public, low-privilege browser viewer that validates canonical Dynamic Logic event packages, replays them deterministically, and renders claims/evidence/judgment/formulas without executing any input-provided code.

**Architecture:** The browser consumes only structured JSON event packages. A strict validation boundary rejects unknown/forbidden fields before events reach an immutable in-memory store. A deterministic projector derives view state at a selected event cursor; the renderer updates DOM using safe APIs, while KaTeX is presentation-only with `trust: false`. This first slice contains no execution provider, credentials, filesystem bridge, MCP, shell, WebAssembly, arbitrary HTML, arbitrary CSS, or arbitrary code runner.

**Tech Stack:** Vite 6, vanilla ES modules, Vitest, AJV, KaTeX.

## Global Constraints

- Browser viewer MUST NOT execute user- or event-provided JavaScript, Python, shell, WebAssembly, HTML, or CSS.
- `eval`, `new Function`, dynamic import URLs, Service Worker registration, filesystem bridge, MCP, shell, Node runtime exposure, and provider credentials are forbidden in viewer source.
- Raw event data MUST NOT be assigned to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`, inline event handlers, or script/style URLs.
- Event input MUST be schema validated before storage or projection.
- Unknown top-level and payload fields MUST fail closed.
- Forbidden field names (`html`, `script`, `javascript`, `css`, `onclick`, `srcdoc`, `iframe`, `eval`, `module`, `worker`, `wasm`, `shell`, `command`) MUST be rejected recursively.
- Imported event packages are limited to 256 KiB and JSON depth 32.
- Formula TeX is presentation data only; input-defined KaTeX macros are forbidden; `trust: false`.
- Replay changes only the event cursor; it MUST NOT trigger execution, network requests, or event mutation.
- No event implies no state transition and no motion.
- `execution_failed`, `omega`, and `provisionally_false` are distinct states/types.
- CSP must deny object/frame/worker/base/form targets and must not include `unsafe-eval`.
- Initial MVP supports same-origin built-in demo loading plus user-selected local JSON files; event data never supplies a fetch URL.
- Every implementation milestone is delivered both to GitHub and as a downloadable ZIP snapshot.

## Planned Tree

```text
Live-Logic-Viewer/
├─ index.html
├─ package.json
├─ public/_headers
├─ schemas/event-package.schema.json
├─ examples/demo-events.json
├─ src/
│  ├─ main.js
│  ├─ styles.css
│  ├─ protocol/{limits.js,validate.js}
│  ├─ store/event-store.js
│  ├─ projection/projector.js
│  ├─ playback/controller.js
│  └─ renderer/{dom.js,formula.js}
├─ tests/
│  ├─ security.test.js
│  ├─ protocol.test.js
│  ├─ projector.test.js
│  ├─ playback.test.js
│  ├─ formula.test.js
│  └─ integration.test.js
└─ docs/
```

## Task 1 — Security Skeleton

Create Vite/Vitest shell, CSP meta fallback, deployment headers, and source-scan tests that reject arbitrary execution primitives. Expected runtime dependencies are only `ajv` and `katex`; dev dependencies `vite` and `vitest`.

Verification:

```bash
npm test -- --run tests/security.test.js
```

## Task 2 — Canonical Event Validation

Create Draft 2020-12 JSON Schema for the closed event union:

```text
claim_created
evidence_added
evidence_invalidated
judgment_transition
metric_update
formula_projection
timeline_marker
execution_completed
execution_failed
```

Implement `parseAndValidatePackage(text)` and `validatePackageObject(value)` with pre-parse byte limit, depth limit, recursive forbidden-key rejection, AJV validation, and deep freeze.

Verification:

```bash
npm test -- --run tests/protocol.test.js
```

## Task 3 — Immutable Store + Deterministic Projector

Implement `createEventStore(pkg)` and `projectAt(store, cursor)`. Projector must reduce only the event prefix and perform no fetch, timer creation, randomness, execution, or time-based mutation. Judgment transition `from` must match current state or fail closed.

Golden sequence:

```text
cursor 0 -> omega/open
cursor 1 -> omega/generating
cursor 2 -> provisionally_true
cursor 3 -> omega/generating (reopened)
cursor 4 -> provisionally_false
```

`execution_failed` changes execution status only and never means false.

## Task 4 — Replay Controller

Implement cursor-only `play()`, `pause()`, `step(delta)`, `seek(cursor)`, `live()`, and `destroy()`. Live is terminal cursor; playback from Live restarts at zero. No replay operation may invoke execution or mutate source events.

## Task 5 — Safe Formula Projection

Implement `renderFormula(target, formula)` with KaTeX:

```js
katex.render(tex, target, {
  throwOnError: false,
  trust: false,
  strict: 'warn',
  output: 'htmlAndMathml'
})
```

Do not accept macros/options from event data. Limit TeX length to 4096 characters.

## Task 6 — Safe DOM Renderer

Implement DOM via `document.createElement` and `textContent`. Never place runtime strings in raw HTML APIs. Render claim, evidence, judgment, metrics, formula, timeline. Apply transition classes only when projected state actually changes.

Security fixture includes literal text:

```text
<img src=x onerror=alert(1)>
```

which must remain inert text.

## Task 7 — File Import + Integrated Viewer

Built-in demo is same-origin only. Local user package uses `<input type="file">`, checks `file.size <= 256 KiB` before reading, validates, stores, projects, and renders. No arbitrary URL field or automatic URL fetch exists.

Full verification:

```bash
npm test -- --run
npm run build
```

## Task 8 — Documentation + Dual Snapshot

Create `README.md` and `SECURITY.md`, run full tests/build, inspect `npm ls --depth=0`, and produce:

```text
Live-Logic-Viewer_Secure-MVP_v0.1_2026-08-17.zip
```

excluding `.git/`, `node_modules/`, and `dist/`, with `SNAPSHOT_SHA256.txt`.

The GitHub branch/PR and downloadable ZIP MUST represent the same implementation state.

## Deferred to the next independent plan

- Thin Control Plane
- Cloudflare Worker
- Cloudflare Sandbox adapter
- authentication/quota
- provider credential handling
- execution request/result protocol
- sandbox egress enforcement
- result signing
- second-provider adapter
