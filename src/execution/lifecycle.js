import { validateExecutionResultObject } from './validate-result.js'
import { validatePackageObject } from '../protocol/validate.js'
import { createEventStore } from '../store/event-store.js'

const INTEGRITY_STATES = new Set(['verified','unsigned-dev','present-unverified','unverified'])

function claimExists(store, claimId) {
  return store.events.some(event => event.type === 'claim_created' && event.claim_id === claimId)
}
function nextSequence(store) {
  return store.events.length ? Math.max(...store.events.map(event => event.sequence)) + 1 : 1
}
function lifecycleLabel(envelope) {
  const provider=envelope.execution.provider
  if(envelope.status==='completed')return`Managed execution ${envelope.job_id} completed via ${provider} with exit code ${envelope.execution.exit_code}.`
  if(envelope.execution.timed_out)return`Managed execution ${envelope.job_id} failed via ${provider}: wall-time limit reached.`
  if(envelope.result.truncated)return`Managed execution ${envelope.job_id} failed via ${provider}: output limit reached.`
  return`Managed execution ${envelope.job_id} failed via ${provider} with exit code ${envelope.execution.exit_code??'unknown'}.`
}
function canonicalNow(nowFactory) {
  const value=nowFactory()
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime()))throw new Error('Lifecycle record time is invalid')
  return date.toISOString()
}
function temporalPayload(envelope,recordedAt,integrityStatus) {
  if(!INTEGRITY_STATES.has(integrityStatus))throw new Error(`Invalid execution integrity status: ${integrityStatus}`)
  const extra={recorded_at:recordedAt,integrity_status:integrityStatus}
  if(envelope.request_id)extra.request_id=envelope.request_id
  if(envelope.completed_at)extra.execution_completed_at=envelope.completed_at
  if(envelope.integrity?.key_id)extra.signing_key_id=envelope.integrity.key_id
  return extra
}

export function createExecutionLifecycleEvent({
  store,
  envelope,
  claimId,
  integrityStatus = envelope?.integrity ? 'present-unverified' : 'unverified',
  eventIdFactory = () => crypto.randomUUID(),
  nowFactory = () => new Date()
}) {
  if(!store||!Array.isArray(store.events))throw new TypeError('A valid event store is required')
  if(typeof claimId!=='string'||!claimExists(store,claimId))throw new Error(`Unknown claim for execution lifecycle: ${claimId}`)
  const safeEnvelope=validateExecutionResultObject(envelope)
  const id=String(eventIdFactory())
  if(!id||id.length>100)throw new Error('Lifecycle event id is invalid')
  const label=lifecycleLabel(safeEnvelope)
  const base={event_id:`execution-${id}`,sequence:nextSequence(store),type:safeEnvelope.status==='completed'?'execution_completed':'execution_failed',claim_id:claimId}

  if(store.schemaVersion==='0.2'){
    const recordedAt=canonicalNow(nowFactory)
    base.occurred_at=safeEnvelope.completed_at??recordedAt
    const temporal=temporalPayload(safeEnvelope,recordedAt,integrityStatus)
    base.payload=safeEnvelope.status==='completed'
      ? {job_id:safeEnvelope.job_id,summary:label,...temporal}
      : {job_id:safeEnvelope.job_id,reason:label,...temporal}
    return base
  }

  base.payload=safeEnvelope.status==='completed'
    ? {job_id:safeEnvelope.job_id,summary:label}
    : {job_id:safeEnvelope.job_id,reason:label}
  return base
}

export function appendExecutionLifecycle(args) {
  const event=createExecutionLifecycleEvent(args)
  const raw={schema_version:args.store.schemaVersion,package_id:args.store.packageId,events:[...args.store.events,event]}
  if(args.store.schemaVersion==='0.2')raw.created_at=args.store.createdAt
  const pkg=validatePackageObject(raw)
  return Object.freeze({store:createEventStore(pkg),event})
}

export function serializeEventStore(store) {
  if(!store||!Array.isArray(store.events))throw new TypeError('A valid event store is required')
  const raw={schema_version:store.schemaVersion,package_id:store.packageId,events:store.events}
  if(store.schemaVersion==='0.2')raw.created_at=store.createdAt
  return JSON.stringify(raw,null,2)+'\n'
}
