# Reproducibility Contract — Integration v0.2

This document describes what must remain fixed or recorded to reproduce the Live Logic Viewer v0.2 build and a deterministic replay result.

## 1. Runtime/toolchain baseline

CI uses:

```text
Node.js 22.23.2
npm 10.x from the selected Node distribution
```

Both package roots declare:

```json
"engines": {
  "node": ">=22 <23"
}
```

Both `.npmrc` files enable `engine-strict=true` and `save-exact=true`.

## 2. Dependency graph

The Viewer and Control Plane keep independent npm roots:

```text
/package.json
/package-lock.json

/control-plane/package.json
/control-plane/package-lock.json
```

Direct dependencies are exact-version pinned. The lockfiles were generated from those verified pins in GitHub Actions under Node 22.23.2 and are committed to source control.

Normal verification uses:

```bash
npm ci
npm audit --audit-level=high

cd control-plane
npm ci
npm audit --audit-level=high
```

CI also exports:

```text
viewer-dependency-tree.json
viewer-dependency-manifest.sha256
control-plane-dependency-tree.json
control-plane-dependency-manifest.sha256
```

These artifacts record the complete installed dependency tree for the passing run.

## 3. GitHub Actions supply chain

Workflow dependencies are pinned to full Git commit SHAs rather than mutable major tags.

At Integration v0.2 the pinned actions are:

```text
actions/checkout v7.0.1
3d3c42e5aac5ba805825da76410c181273ba90b1

actions/setup-node v7.0.0
820762786026740c76f36085b0efc47a31fe5020

actions/upload-artifact v7.0.1
043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
```

`tests/ci-supply-chain.test.js` rejects a return to mutable `actions/*@vN` references.

## 4. Commit-matched source snapshot

Every pull-request run produces an exact-head source archive:

```text
Live-Logic-Viewer_Integration-v0.2_<commit-prefix>.zip
```

The archive contains:

```text
GITHUB_COMMIT.txt
FILE_MANIFEST.sha256
```

The workflow also emits a SHA-256 file for the outer source ZIP. A valid handoff snapshot must therefore satisfy all three conditions:

1. the outer ZIP digest matches its `.sha256` file;
2. `GITHUB_COMMIT.txt` names the expected Git commit;
3. `sha256sum -c FILE_MANIFEST.sha256` succeeds inside the extracted source tree.

## 5. Deterministic replay contract

The Viewer exports a replay fingerprint with a closed JSON Schema:

```text
schemas/replay-fingerprint.schema.json
```

A fingerprint records:

```text
fingerprint_version
canonicalization
hash_algorithm
projector_version
package_id
event_schema_version
event_cursor
event_prefix_sha256
projection_sha256
```

The two hashes intentionally answer different questions:

- `event_prefix_sha256`: which committed event history prefix was replayed?
- `projection_sha256`: what deterministic state did the projector produce from that prefix?

If two implementations receive the same validated event prefix but produce different projection hashes, the disagreement is in projection semantics or implementation rather than the source history.

Replay fingerprinting does **not** establish epistemic truth. It establishes computational identity relative to the recorded schema/projector/canonicalization versions.

## 6. Time semantics

Event package v0.1 is sequence-only.

Event package v0.2 records canonical UTC wall-time metadata while keeping `sequence` as the only replay ordering authority. Therefore reproducibility requires preserving both:

```text
sequence       # computational/replay order
occurred_at    # recorded wall-time fact
```

A v0.1 → v0.2 migration refuses to invent missing historical timestamps.

## 7. Managed execution reproducibility boundary

A signed execution result preserves:

- source/request hashes;
- client request id;
- Control Plane receive/complete times;
- provider/runtime metadata;
- exit/timeout/truncation state;
- stdout/stderr;
- signature payload version and key id.

This allows the exact result envelope to be audited later, but it does not guarantee that rerunning the same source on a future provider/runtime produces identical output.

Therefore:

```text
Replay != Re-execution
Signed result identity != Future execution identity
```

Provider/runtime image pinning and live deployment smoke tests remain part of the account-specific deployment calibration.

## 8. Production build check

CI performs a Vite production build and scans the emitted `dist/` tree for Control Plane-only markers, including private signing configuration and the Cloudflare Sandbox dependency.

The build must not contain:

```text
RESULT_SIGNING_PRIVATE_JWK
CONTROL_API_TOKEN
RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS
@cloudflare/sandbox
```

## 9. Minimal verification sequence

Viewer:

```bash
npm ci
npm run verify:core
npx vitest run tests
npm run build
```

Control Plane:

```bash
cd control-plane
npm ci
npm run verify:core
npm test
```

Then verify the source snapshot and replay fingerprint for the exact commit under review.
