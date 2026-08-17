import { RESULT_INTEGRITY_ALGORITHM } from '../../shared/execution-result-integrity.js'

export const CAPABILITIES_ENDPOINT = '/v1/capabilities'

export class CapabilityValidationError extends Error {
  constructor(message) { super(message); this.name = 'CapabilityValidationError' }
}

const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CapabilityValidationError(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new CapabilityValidationError(`${label}: unknown field "${key}"`)
}

function validatePublicJwk(value, required) {
  if (!required && value === null) return null
  exactKeys(value, new Set(['kty','crv','x','y']), 'result_integrity.public_jwk')
  if (value.kty !== 'EC' || value.crv !== 'P-256' || typeof value.x !== 'string' || typeof value.y !== 'string') {
    throw new CapabilityValidationError('Result signing public key must be EC P-256')
  }
  return Object.freeze({ kty:value.kty, crv:value.crv, x:value.x, y:value.y })
}

export function validateExecutionCapabilities(value) {
  exactKeys(value, new Set(['schema_version','runners','network_policies','limits','execution_result_is_evidence','result_integrity']), 'capabilities')
  if (value.schema_version !== '0.1') throw new CapabilityValidationError('Unsupported capabilities schema')
  if (!Array.isArray(value.runners) || value.runners.length !== 1 || value.runners[0] !== 'python') throw new CapabilityValidationError('Viewer v0.1 requires exactly the python runner')
  if (!Array.isArray(value.network_policies) || value.network_policies.length !== 1 || value.network_policies[0] !== 'deny') throw new CapabilityValidationError('Viewer v0.1 requires exactly network deny')
  if (value.execution_result_is_evidence !== false) throw new CapabilityValidationError('Execution results must not be declared evidence')
  exactKeys(value.limits, new Set(['max_source_bytes','min_wall_ms','max_wall_ms','min_output_bytes','max_output_bytes']), 'limits')
  const l=value.limits
  for(const key of ['max_source_bytes','min_wall_ms','max_wall_ms','min_output_bytes','max_output_bytes'])if(!Number.isInteger(l[key])||l[key]<=0)throw new CapabilityValidationError(`Invalid ${key}`)
  if(l.max_source_bytes>64*1024)throw new CapabilityValidationError('Server source limit is broader than Viewer v0.1')
  if(!(l.min_wall_ms<=5000&&l.max_wall_ms>=5000&&l.max_wall_ms<=10000))throw new CapabilityValidationError('Server wall-time policy is incompatible with Viewer v0.1')
  if(!(l.min_output_bytes<=65536&&l.max_output_bytes>=1024&&l.max_output_bytes<=65536))throw new CapabilityValidationError('Server output policy is incompatible with Viewer v0.1')

  exactKeys(value.result_integrity, new Set(['required','algorithm','key_id','public_jwk']), 'result_integrity')
  const integrity=value.result_integrity
  if(typeof integrity.required!=='boolean')throw new CapabilityValidationError('result_integrity.required must be boolean')
  if(integrity.algorithm!==RESULT_INTEGRITY_ALGORITHM)throw new CapabilityValidationError('Unsupported result integrity algorithm')
  if(integrity.required){
    if(typeof integrity.key_id!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(integrity.key_id))throw new CapabilityValidationError('Result signing key id is invalid')
  }else if(integrity.key_id!==null&&typeof integrity.key_id!=='string')throw new CapabilityValidationError('Optional result signing key id is invalid')
  const publicJwk=validatePublicJwk(integrity.public_jwk,integrity.required)

  return Object.freeze({
    ...value,
    runners:Object.freeze([...value.runners]),
    network_policies:Object.freeze([...value.network_policies]),
    limits:Object.freeze({...value.limits}),
    result_integrity:Object.freeze({...integrity,public_jwk:publicJwk})
  })
}

export async function fetchExecutionCapabilities(fetchImpl=fetch){
  const response=await fetchImpl(CAPABILITIES_ENDPOINT,{method:'GET',credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer'})
  if(!response.ok)throw new Error(`Capability discovery failed: HTTP ${response.status}`)
  let value
  try{value=JSON.parse(await response.text())}catch{throw new CapabilityValidationError('Capabilities response is not valid JSON')}
  return validateExecutionCapabilities(value)
}

export function safeExecutionLimits(capabilities){
  const caps=validateExecutionCapabilities(capabilities)
  return Object.freeze({max_source_bytes:Math.min(64*1024,caps.limits.max_source_bytes),wall_ms:5000,output_bytes:Math.min(65536,caps.limits.max_output_bytes)})
}
