import { canonicalExecutionRequest } from '../../shared/execution-request.js'
import { sha256Hex } from '../../shared/sha256.js'

function bytes(text){return new TextEncoder().encode(String(text))}
function truncateUtf8(text,maxBytes){const source=String(text??'');const encoded=bytes(source);if(encoded.byteLength<=maxBytes)return{text:source,truncated:false};const points=[...source];let lo=0,hi=points.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(bytes(points.slice(0,mid).join('')).byteLength<=maxBytes)lo=mid;else hi=mid-1}return{text:points.slice(0,lo).join(''),truncated:true}}
function auditTime(value,label){const text=value??new Date().toISOString();if(typeof text!=='string'||!Number.isFinite(Date.parse(text)))throw new Error(`${label} must be an ISO-compatible timestamp`);return text}

export async function canonicalizeExecutionResult({jobId,request,raw,wallMs,receivedAt,completedAt}){
  const cap=request.limits.output_bytes
  const stdout=truncateUtf8(raw.stdout,cap)
  const remaining=Math.max(0,cap-bytes(stdout.text).byteLength)
  const stderr=truncateUtf8(raw.stderr,remaining)
  const outputLimited=Boolean(raw.outputLimited)
  const received=auditTime(receivedAt,'receivedAt')
  const completed=auditTime(completedAt,'completedAt')
  if(Date.parse(completed)<Date.parse(received))throw new Error('completedAt must not precede receivedAt')

  return Object.freeze({
    schema_version:'0.1',
    job_id:jobId,
    request_id:request.request_id,
    received_at:received,
    completed_at:completed,
    status:raw.exitCode===0&&!raw.timedOut&&!outputLimited?'completed':'failed',
    execution:Object.freeze({provider:String(raw.provider||'unknown'),runner:'python',exit_code:Number.isInteger(raw.exitCode)?raw.exitCode:null,timed_out:Boolean(raw.timedOut),wall_ms:Math.max(0,Math.trunc(Number(wallMs)||0))}),
    result:Object.freeze({type:'text',stdout:stdout.text,stderr:stderr.text,truncated:outputLimited||stdout.truncated||stderr.truncated}),
    provenance:Object.freeze({request_sha256:await sha256Hex(canonicalExecutionRequest(request)),source_sha256:await sha256Hex(request.source)})
  })
}
