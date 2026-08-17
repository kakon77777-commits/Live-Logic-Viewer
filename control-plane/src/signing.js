import { RESULT_INTEGRITY_ALGORITHM, signExecutionResult } from '../../shared/execution-result-integrity.js'

function parseJwk(value, label) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.length) throw new Error(`${label} is required`)
  try { return JSON.parse(value) }
  catch { throw new Error(`${label} is not valid JSON`) }
}

function validateKeyId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error('RESULT_SIGNING_KEY_ID is invalid')
  return value
}

function publicOnly(jwk) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('RESULT_SIGNING_PUBLIC_JWK must be an EC P-256 public key')
  }
  if (jwk.d) throw new Error('RESULT_SIGNING_PUBLIC_JWK must not contain private key material')
  return Object.freeze({ kty:'EC', crv:'P-256', x:jwk.x, y:jwk.y })
}

export function resultSigningConfig(env = {}) {
  const unsignedDev = env.ALLOW_UNSIGNED_RESULTS_DEV === 'true'
  const hasAny = Boolean(env.RESULT_SIGNING_PRIVATE_JWK || env.RESULT_SIGNING_PUBLIC_JWK || env.RESULT_SIGNING_KEY_ID)

  if (unsignedDev && !hasAny) {
    return Object.freeze({ required:false, algorithm:RESULT_INTEGRITY_ALGORITHM, key_id:null, public_jwk:null, private_jwk:null })
  }

  const keyId = validateKeyId(env.RESULT_SIGNING_KEY_ID)
  const publicJwk = publicOnly(parseJwk(env.RESULT_SIGNING_PUBLIC_JWK, 'RESULT_SIGNING_PUBLIC_JWK'))
  const privateJwk = parseJwk(env.RESULT_SIGNING_PRIVATE_JWK, 'RESULT_SIGNING_PRIVATE_JWK')
  if (!privateJwk.d || privateJwk.kty !== 'EC' || privateJwk.crv !== 'P-256' || typeof privateJwk.x !== 'string' || typeof privateJwk.y !== 'string') {
    throw new Error('RESULT_SIGNING_PRIVATE_JWK must contain EC P-256 private key material')
  }
  if (privateJwk.x !== publicJwk.x || privateJwk.y !== publicJwk.y) throw new Error('RESULT_SIGNING_PRIVATE_JWK does not match RESULT_SIGNING_PUBLIC_JWK')

  return Object.freeze({ required:true, algorithm:RESULT_INTEGRITY_ALGORITHM, key_id:keyId, public_jwk:publicJwk, private_jwk:Object.freeze({ ...privateJwk }) })
}

export function signingCapability(env = {}) {
  const config = resultSigningConfig(env)
  return Object.freeze({ required:config.required, algorithm:config.algorithm, key_id:config.key_id, public_jwk:config.public_jwk })
}

export async function signCanonicalExecutionEnvelope(envelope, env = {}) {
  const config = resultSigningConfig(env)
  if (!config.required) return envelope
  const integrity = await signExecutionResult(envelope, config.private_jwk, config.key_id)
  return Object.freeze({ ...envelope, integrity })
}
