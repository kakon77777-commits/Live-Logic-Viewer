import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../../schemas/execution-result.schema.json'
import { FORBIDDEN_KEYS, MAX_JSON_DEPTH } from '../protocol/limits.js'

export const MAX_EXECUTION_RESULT_BYTES = 192 * 1024
const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateSchema = ajv.compile(schema)

export class ExecutionResultValidationError extends Error {
  constructor(message) { super(message); this.name = 'ExecutionResultValidationError' }
}
function byteLength(text) { return new TextEncoder().encode(text).byteLength }
function inspect(value, depth=1, path='$') {
  if (depth > MAX_JSON_DEPTH) throw new ExecutionResultValidationError(`JSON nesting exceeds ${MAX_JSON_DEPTH} at ${path}`)
  if (Array.isArray(value)) { value.forEach((item,i)=>inspect(item,depth+1,`${path}[${i}]`)); return }
  if (!value || typeof value !== 'object') return
  for (const [key,child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new ExecutionResultValidationError(`Forbidden field: ${key}`)
    inspect(child,depth+1,`${path}.${key}`)
  }
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
export function validateExecutionResultObject(value) {
  inspect(value)
  if (!validateSchema(value)) {
    const detail=validateSchema.errors?.map(e=>`${e.instancePath||'$'} ${e.message}`).join('; ')||'schema mismatch'
    throw new ExecutionResultValidationError(`Invalid execution result: ${detail}`)
  }
  return deepFreeze(value)
}
export function parseAndValidateExecutionResult(text) {
  if (typeof text !== 'string') throw new ExecutionResultValidationError('Execution result input must be UTF-8 text')
  if (byteLength(text) > MAX_EXECUTION_RESULT_BYTES) throw new ExecutionResultValidationError(`Execution result exceeds ${MAX_EXECUTION_RESULT_BYTES} bytes`)
  let value
  try { value=JSON.parse(text) } catch(error) { throw new ExecutionResultValidationError(`Invalid JSON: ${error.message}`) }
  return validateExecutionResultObject(value)
}
