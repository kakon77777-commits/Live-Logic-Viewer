const MAX_REQUEST_BYTES = 96 * 1024
const MAX_SOURCE_BYTES = 64 * 1024
const MIN_WALL_MS = 100
const MAX_WALL_MS = 10_000
const MIN_OUTPUT_BYTES = 1024
const MAX_OUTPUT_BYTES = 65_536
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{16,128}$/

export class ExecutionProtocolError extends Error {
  constructor(message, code = 'invalid_request') { super(message); this.name = 'ExecutionProtocolError'; this.code = code }
}
const isPlainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
function exactKeys(value,allowed,label){for(const key of Object.keys(value)){if(!allowed.has(key))throw new ExecutionProtocolError(`${label}: unknown field "${key}"`)}}
function utf8Bytes(text){return new TextEncoder().encode(String(text)).byteLength}
export function parseExecutionRequest(text){if(typeof text!=='string')throw new ExecutionProtocolError('request body must be UTF-8 JSON text');if(utf8Bytes(text)>MAX_REQUEST_BYTES)throw new ExecutionProtocolError('request body exceeds 96 KiB','request_too_large');let value;try{value=JSON.parse(text)}catch{throw new ExecutionProtocolError('request body is not valid JSON')}return validateExecutionRequest(value)}
export function validateExecutionRequest(value){if(!isPlainObject(value))throw new ExecutionProtocolError('request must be an object');exactKeys(value,new Set(['schema_version','request_id','runner','source','network_policy','limits']),'request');if(value.schema_version!=='0.1')throw new ExecutionProtocolError('schema_version must be "0.1"');if(typeof value.request_id!=='string'||!REQUEST_ID_RE.test(value.request_id))throw new ExecutionProtocolError('request_id must be a 16-128 character nonce');if(value.runner!=='python')throw new ExecutionProtocolError('v0.1 only permits runner "python"');if(typeof value.source!=='string'||!value.source.length)throw new ExecutionProtocolError('source must be a non-empty string');if(utf8Bytes(value.source)>MAX_SOURCE_BYTES)throw new ExecutionProtocolError('source exceeds 64 KiB','source_too_large');if(!isPlainObject(value.network_policy))throw new ExecutionProtocolError('network_policy is required');exactKeys(value.network_policy,new Set(['mode']),'network_policy');if(value.network_policy.mode!=='deny')throw new ExecutionProtocolError('v0.1 requires network_policy.mode = "deny"');if(!isPlainObject(value.limits))throw new ExecutionProtocolError('limits are required');exactKeys(value.limits,new Set(['wall_ms','output_bytes']),'limits');if(!Number.isInteger(value.limits.wall_ms)||value.limits.wall_ms<MIN_WALL_MS||value.limits.wall_ms>MAX_WALL_MS)throw new ExecutionProtocolError('limits.wall_ms must be an integer from 100 to 10000');if(!Number.isInteger(value.limits.output_bytes)||value.limits.output_bytes<MIN_OUTPUT_BYTES||value.limits.output_bytes>MAX_OUTPUT_BYTES)throw new ExecutionProtocolError('limits.output_bytes must be an integer from 1024 to 65536');return deepFreeze(structuredClone(value))}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value)}return value}
export const EXECUTION_LIMITS=Object.freeze({maxRequestBytes:MAX_REQUEST_BYTES,maxSourceBytes:MAX_SOURCE_BYTES,minWallMs:MIN_WALL_MS,maxWallMs:MAX_WALL_MS,minOutputBytes:MIN_OUTPUT_BYTES,maxOutputBytes:MAX_OUTPUT_BYTES})
