export function buildExecutionRequest(source, limits = { wall_ms: 5000, output_bytes: 65536 }) {
  return { schema_version: '0.1', runner: 'python', source, network_policy: { mode: 'deny' }, limits: { wall_ms: limits.wall_ms, output_bytes: limits.output_bytes } }
}
export function canonicalExecutionRequest(request) {
  return JSON.stringify({ schema_version: request.schema_version, runner: request.runner, source: request.source, network_policy: request.network_policy, limits: request.limits })
}
