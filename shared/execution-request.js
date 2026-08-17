const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{16,128}$/

export function buildExecutionRequest(source, limits = { wall_ms: 5000, output_bytes: 65536 }, requestId) {
  if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) {
    throw new Error('request_id must be a 16-128 character nonce')
  }
  return {
    schema_version: '0.1',
    request_id: requestId,
    runner: 'python',
    source,
    network_policy: { mode: 'deny' },
    limits: { wall_ms: limits.wall_ms, output_bytes: limits.output_bytes }
  }
}

export function canonicalExecutionRequest(request) {
  return JSON.stringify({
    schema_version: request.schema_version,
    request_id: request.request_id,
    runner: request.runner,
    source: request.source,
    network_policy: request.network_policy,
    limits: request.limits
  })
}
