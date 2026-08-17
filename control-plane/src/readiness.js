import { assertExecutionProvider } from './provider.js'
import { rateLimitConfiguration } from './rate-limit.js'
import { signingCapability } from './signing.js'

function originReady(env) {
  if (typeof env?.VIEWER_ORIGIN !== 'string' || !env.VIEWER_ORIGIN.length) return false
  try {
    const url = new URL(env.VIEWER_ORIGIN)
    if (url.origin !== env.VIEWER_ORIGIN) return false
    if (url.protocol === 'https:') return true
    return env.ALLOW_INSECURE_ORIGIN_DEV === 'true' && url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

function authReady(env) {
  return typeof env?.CONTROL_API_TOKEN === 'string' && env.CONTROL_API_TOKEN.length >= 16
}

export function controlPlaneReadiness(providerFactory, env = {}) {
  const checks = {
    viewer_origin: originReady(env) ? 'ready' : 'missing-or-insecure',
    authorization: authReady(env) ? 'ready' : 'missing',
    rate_limit: 'missing',
    result_integrity: 'invalid',
    provider: 'invalid'
  }

  const rate = rateLimitConfiguration(env)
  checks.rate_limit = rate.ready ? rate.mode : 'missing'

  try {
    const signing = signingCapability(env)
    checks.result_integrity = signing.required ? 'signed' : 'explicit-dev-unsigned'
  } catch {
    checks.result_integrity = 'invalid'
  }

  try {
    assertExecutionProvider(providerFactory(env))
    checks.provider = 'ready'
  } catch {
    checks.provider = 'invalid'
  }

  const ready = checks.viewer_origin === 'ready' &&
    checks.authorization === 'ready' &&
    checks.rate_limit !== 'missing' &&
    checks.result_integrity !== 'invalid' &&
    checks.provider === 'ready'

  return Object.freeze({
    ready,
    service: 'live-logic-control-plane',
    checks: Object.freeze({ ...checks })
  })
}
