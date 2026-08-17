export const RESULT_INTEGRITY_ALGORITHM = 'ECDSA_P256_SHA256'

const encoder = new TextEncoder()

function bytes(text) {
  return encoder.encode(String(text))
}

function base64UrlEncode(buffer) {
  const data = new Uint8Array(buffer)
  let binary = ''
  for (const value of data) binary += String.fromCharCode(value)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new Error('Invalid base64url signature')
  }
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}

export function canonicalExecutionResultForIntegrity(envelope) {
  return JSON.stringify({
    schema_version: envelope.schema_version,
    job_id: envelope.job_id,
    status: envelope.status,
    execution: {
      provider: envelope.execution.provider,
      runner: envelope.execution.runner,
      exit_code: envelope.execution.exit_code,
      timed_out: envelope.execution.timed_out,
      wall_ms: envelope.execution.wall_ms
    },
    result: {
      type: envelope.result.type,
      stdout: envelope.result.stdout,
      stderr: envelope.result.stderr,
      truncated: envelope.result.truncated
    },
    provenance: {
      request_sha256: envelope.provenance.request_sha256,
      source_sha256: envelope.provenance.source_sha256
    }
  })
}

function assertPublicJwk(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) throw new Error('Signing public JWK is required')
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('Signing public JWK must be an EC P-256 key')
  }
  if ('d' in jwk) throw new Error('Signing public JWK must not contain private key material')
  return jwk
}

function assertPrivateJwk(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) throw new Error('Signing private JWK is required')
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || typeof jwk.d !== 'string') {
    throw new Error('Signing private JWK must be an EC P-256 private key')
  }
  return jwk
}

export async function signExecutionResult(envelope, privateJwk, keyId) {
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(keyId)) throw new Error('Invalid signing key id')
  const key = await crypto.subtle.importKey(
    'jwk',
    assertPrivateJwk(privateJwk),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    bytes(canonicalExecutionResultForIntegrity(envelope))
  )
  return Object.freeze({
    algorithm: RESULT_INTEGRITY_ALGORITHM,
    key_id: keyId,
    signature: base64UrlEncode(signature)
  })
}

export async function verifyExecutionResultIntegrity(envelope, publicJwk, expectedKeyId) {
  const integrity = envelope?.integrity
  if (!integrity || typeof integrity !== 'object') throw new Error('Execution result signature is required')
  if (integrity.algorithm !== RESULT_INTEGRITY_ALGORITHM) throw new Error('Unsupported execution result signature algorithm')
  if (integrity.key_id !== expectedKeyId) throw new Error('Execution result signing key mismatch')
  const key = await crypto.subtle.importKey(
    'jwk',
    assertPublicJwk(publicJwk),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  )
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64UrlDecode(integrity.signature),
    bytes(canonicalExecutionResultForIntegrity(envelope))
  )
  if (!ok) throw new Error('Execution result signature verification failed')
  return envelope
}
