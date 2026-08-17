export async function enforceExecutionRateLimit(request, env) {
  if (env?.ALLOW_UNLIMITED_DEV === 'true') return { allowed: true, mode: 'explicit-dev-bypass' }
  const limiter = env?.EXECUTION_RATE_LIMITER
  if (!limiter || typeof limiter.limit !== 'function') return { allowed: false, misconfigured: true }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const result = await limiter.limit({ key: `execution:${ip}` })
  return { allowed: Boolean(result?.success), mode: 'binding' }
}
