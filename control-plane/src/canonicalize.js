import { canonicalExecutionRequest } from '../../shared/execution-request.js'
import { sha256Hex } from '../../shared/sha256.js'

function bytes(text) {
  return new TextEncoder().encode(String(text))
}

function truncateUtf8(text, maxBytes) {
  const source = String(text ?? '')
  const encoded = bytes(source)
  if (encoded.byteLength <= maxBytes) return { text: source, truncated: false }
  const points = [...source]
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (bytes(points.slice(0, mid).join('')).byteLength <= maxBytes) lo = mid
    else hi = mid - 1
  }
  return { text: points.slice(0, lo).join(''), truncated: true }
}

export async function canonicalizeExecutionResult({ jobId, request, raw, wallMs }) {
  const cap = request.limits.output_bytes
  const stdout = truncateUtf8(raw.stdout, cap)
  const remaining = Math.max(0, cap - bytes(stdout.text).byteLength)
  const stderr = truncateUtf8(raw.stderr, remaining)
  const outputLimited = Boolean(raw.outputLimited)

  return Object.freeze({
    schema_version: '0.1',
    job_id: jobId,
    status: raw.exitCode === 0 && !raw.timedOut && !outputLimited ? 'completed' : 'failed',
    execution: Object.freeze({
      provider: String(raw.provider || 'unknown'),
      runner: 'python',
      exit_code: Number.isInteger(raw.exitCode) ? raw.exitCode : null,
      timed_out: Boolean(raw.timedOut),
      wall_ms: Math.max(0, Math.trunc(Number(wallMs) || 0))
    }),
    result: Object.freeze({
      type: 'text',
      stdout: stdout.text,
      stderr: stderr.text,
      truncated: outputLimited || stdout.truncated || stderr.truncated
    }),
    provenance: Object.freeze({
      request_sha256: await sha256Hex(canonicalExecutionRequest(request)),
      source_sha256: await sha256Hex(request.source)
    })
  })
}
