export function rateLimitConfiguration(env) {
  if (env?.ALLOW_UNLIMITED_DEV === 'true') return Object.freeze({ ready:true, mode:'explicit-dev-bypass' })
  const limiter = env?.EXECUTION_RATE_LIMITER
  if (!limiter || typeof limiter.limit !== 'function') return Object.freeze({ ready:false, mode:'missing' })
  return Object.freeze({ ready:true, mode:'binding' })
}

export async function enforceExecutionRateLimit(request, env) {
  const config = rateLimitConfiguration(env)
  if (!config.ready) return { allowed:false, misconfigured:true }
  if (config.mode === 'explicit-dev-bypass') return { allowed:true, mode:config.mode }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const result = await env.EXECUTION_RATE_LIMITER.limit({ key: `execution:${ip}` })
  return { allowed:Boolean(result?.success), mode:'binding' }
}
