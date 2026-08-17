import { RESULT_INTEGRITY_ALGORITHM, signExecutionResult } from '../../shared/execution-result-integrity.js'

const MAX_VERIFICATION_KEYS = 5
const P256_COORDINATE_RE=/^[A-Za-z0-9_-]{43}$/

function parseJson(value, label) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.length) throw new Error(`${label} is required`)
  try { return JSON.parse(value) }
  catch { throw new Error(`${label} is not valid JSON`) }
}

function validateKeyId(value, label = 'RESULT_SIGNING_KEY_ID') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function publicOnly(jwk, label = 'RESULT_SIGNING_PUBLIC_JWK') {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !P256_COORDINATE_RE.test(jwk.x) || !P256_COORDINATE_RE.test(jwk.y)) {
    throw new Error(`${label} must be an EC P-256 public key with canonical 32-byte base64url coordinates`)
  }
  if (jwk.d) throw new Error(`${label} must not contain private key material`)
  return Object.freeze({ kty:'EC', crv:'P-256', x:jwk.x, y:jwk.y })
}

function previousVerificationKeys(env, activeKeyId) {
  if (!env.RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS) return Object.freeze([])
  const value = parseJson(env.RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS, 'RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS')
  if (!Array.isArray(value)) throw new Error('RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS must be a JSON array')
  if (value.length > MAX_VERIFICATION_KEYS - 1) throw new Error(`RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS supports at most ${MAX_VERIFICATION_KEYS - 1} previous keys`)
  const seen = new Set([activeKeyId])
  return Object.freeze(value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Previous signing key ${index} must be an object`)
    for (const key of Object.keys(entry)) if (!['key_id','public_jwk'].includes(key)) throw new Error(`Previous signing key ${index}: unknown field "${key}"`)
    const keyId = validateKeyId(entry.key_id, `Previous signing key ${index} key_id`)
    if (seen.has(keyId)) throw new Error(`Duplicate result signing key id: ${keyId}`)
    seen.add(keyId)
    return Object.freeze({ key_id:keyId, public_jwk:publicOnly(entry.public_jwk, `Previous signing key ${index} public_jwk`) })
  }))
}

export function resultSigningConfig(env = {}) {
  const unsignedDev = env.ALLOW_UNSIGNED_RESULTS_DEV === 'true'
  const hasAny = Boolean(env.RESULT_SIGNING_PRIVATE_JWK || env.RESULT_SIGNING_PUBLIC_JWK || env.RESULT_SIGNING_KEY_ID || env.RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS)

  if (unsignedDev && !hasAny) {
    return Object.freeze({ required:false, algorithm:RESULT_INTEGRITY_ALGORITHM, key_id:null, public_jwk:null, private_jwk:null, verification_keys:Object.freeze([]) })
  }

  const keyId = validateKeyId(env.RESULT_SIGNING_KEY_ID)
  const publicJwk = publicOnly(parseJson(env.RESULT_SIGNING_PUBLIC_JWK, 'RESULT_SIGNING_PUBLIC_JWK'))
  const privateJwk = parseJson(env.RESULT_SIGNING_PRIVATE_JWK, 'RESULT_SIGNING_PRIVATE_JWK')
  if (!privateJwk || privateJwk.kty !== 'EC' || privateJwk.crv !== 'P-256' || !P256_COORDINATE_RE.test(privateJwk.x) || !P256_COORDINATE_RE.test(privateJwk.y) || !P256_COORDINATE_RE.test(privateJwk.d)) {
    throw new Error('RESULT_SIGNING_PRIVATE_JWK must contain canonical EC P-256 private key material')
  }
  if (privateJwk.x !== publicJwk.x || privateJwk.y !== publicJwk.y) throw new Error('RESULT_SIGNING_PRIVATE_JWK does not match RESULT_SIGNING_PUBLIC_JWK')

  const previous = previousVerificationKeys(env, keyId)
  const verificationKeys = Object.freeze([
    Object.freeze({ key_id:keyId, public_jwk:publicJwk }),
    ...previous
  ])

  return Object.freeze({ required:true, algorithm:RESULT_INTEGRITY_ALGORITHM, key_id:keyId, public_jwk:publicJwk, private_jwk:Object.freeze({ ...privateJwk }), verification_keys:verificationKeys })
}

export function signingCapability(env = {}) {
  const config = resultSigningConfig(env)
  return Object.freeze({
    required:config.required,
    algorithm:config.algorithm,
    key_id:config.key_id,
    public_jwk:config.public_jwk,
    verification_keys:config.verification_keys
  })
}

export async function signCanonicalExecutionEnvelope(envelope, env = {}) {
  const config = resultSigningConfig(env)
  if (!config.required) return envelope
  const integrity = await signExecutionResult(envelope, config.private_jwk, config.key_id)
  return Object.freeze({ ...envelope, integrity })
}
