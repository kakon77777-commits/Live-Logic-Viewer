import Ajv2020 from 'ajv/dist/2020.js'
import schemaV01 from '../../schemas/event-package.schema.json'
import schemaV02 from '../../schemas/event-package-v0.2.schema.json'
import { FORBIDDEN_KEYS, MAX_JSON_DEPTH, MAX_PACKAGE_BYTES } from './limits.js'

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validators = new Map([
  ['0.1', ajv.compile(schemaV01)],
  ['0.2', ajv.compile(schemaV02)]
])

export class ProtocolValidationError extends Error {
  constructor(message) { super(message); this.name = 'ProtocolValidationError' }
}

function byteLength(text) { return new TextEncoder().encode(text).byteLength }

function inspect(value, depth = 1, path = '$') {
  if (depth > MAX_JSON_DEPTH) throw new ProtocolValidationError(`JSON nesting exceeds ${MAX_JSON_DEPTH} at ${path}`)
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, depth + 1, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new ProtocolValidationError(`Forbidden field: ${key}`)
    inspect(child, depth + 1, `${path}.${key}`)
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function assertCanonicalTimestamp(text, path) {
  const time = Date.parse(text)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== text) {
    throw new ProtocolValidationError(`${path} must be a canonical UTC timestamp`)
  }
}

function validateTemporalSemantics(value) {
  if (value.schema_version !== '0.2') return
  assertCanonicalTimestamp(value.created_at, '$.created_at')
  for (let i = 0; i < value.events.length; i += 1) {
    assertCanonicalTimestamp(value.events[i].occurred_at, `$.events[${i}].occurred_at`)
    const payload = value.events[i].payload
    if (payload?.execution_completed_at !== undefined) assertCanonicalTimestamp(payload.execution_completed_at, `$.events[${i}].payload.execution_completed_at`)
    if (payload?.recorded_at !== undefined) assertCanonicalTimestamp(payload.recorded_at, `$.events[${i}].payload.recorded_at`)
  }
}

export function validatePackageObject(value) {
  let serialized
  try { serialized = JSON.stringify(value) }
  catch { throw new ProtocolValidationError('Event package must be JSON-serializable') }
  if (byteLength(serialized) > MAX_PACKAGE_BYTES) throw new ProtocolValidationError(`Package exceeds ${MAX_PACKAGE_BYTES} bytes`)

  inspect(value)
  const validator = validators.get(value?.schema_version)
  if (!validator) throw new ProtocolValidationError(`Unsupported event package schema_version: ${value?.schema_version ?? 'missing'}`)
  if (!validator(value)) {
    const detail = validator.errors?.map(e => `${e.instancePath || '$'} ${e.message}`).join('; ') || 'schema mismatch'
    throw new ProtocolValidationError(`Invalid event package: ${detail}`)
  }
  validateTemporalSemantics(value)

  let previous = 0
  const ids = new Set()
  for (const event of value.events) {
    if (ids.has(event.event_id)) throw new ProtocolValidationError(`Duplicate event_id: ${event.event_id}`)
    ids.add(event.event_id)
    if (event.sequence <= previous) throw new ProtocolValidationError('Event sequence must be strictly increasing')
    previous = event.sequence
  }
  return deepFreeze(value)
}

export function parseAndValidatePackage(text) {
  if (typeof text !== 'string') throw new ProtocolValidationError('Package input must be UTF-8 text')
  if (byteLength(text) > MAX_PACKAGE_BYTES) throw new ProtocolValidationError(`Package exceeds ${MAX_PACKAGE_BYTES} bytes`)
  let value
  try { value = JSON.parse(text) }
  catch (error) { throw new ProtocolValidationError(`Invalid JSON: ${error.message}`) }
  return validatePackageObject(value)
}
