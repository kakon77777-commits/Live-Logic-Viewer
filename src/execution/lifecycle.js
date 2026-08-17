import { validateExecutionResultObject } from './validate-result.js'
import { validatePackageObject } from '../protocol/validate.js'
import { createEventStore } from '../store/event-store.js'

function claimExists(store, claimId) {
  return store.events.some(event => event.type === 'claim_created' && event.claim_id === claimId)
}

function nextSequence(store) {
  return store.events.length
    ? Math.max(...store.events.map(event => event.sequence)) + 1
    : 1
}

function lifecycleLabel(envelope) {
  const provider = envelope.execution.provider
  if (envelope.status === 'completed') {
    return `Managed execution ${envelope.job_id} completed via ${provider} with exit code ${envelope.execution.exit_code}.`
  }
  if (envelope.execution.timed_out) {
    return `Managed execution ${envelope.job_id} failed via ${provider}: wall-time limit reached.`
  }
  if (envelope.result.truncated) {
    return `Managed execution ${envelope.job_id} failed via ${provider}: output limit reached.`
  }
  return `Managed execution ${envelope.job_id} failed via ${provider} with exit code ${envelope.execution.exit_code ?? 'unknown'}.`
}

export function createExecutionLifecycleEvent({
  store,
  envelope,
  claimId,
  eventIdFactory = () => crypto.randomUUID()
}) {
  if (!store || !Array.isArray(store.events)) throw new TypeError('A valid event store is required')
  if (typeof claimId !== 'string' || !claimExists(store, claimId)) {
    throw new Error(`Unknown claim for execution lifecycle: ${claimId}`)
  }

  const safeEnvelope = validateExecutionResultObject(envelope)
  const id = String(eventIdFactory())
  if (!id || id.length > 100) throw new Error('Lifecycle event id is invalid')
  const label = lifecycleLabel(safeEnvelope)

  return safeEnvelope.status === 'completed'
    ? {
        event_id: `execution-${id}`,
        sequence: nextSequence(store),
        type: 'execution_completed',
        claim_id: claimId,
        payload: { job_id: safeEnvelope.job_id, summary: label }
      }
    : {
        event_id: `execution-${id}`,
        sequence: nextSequence(store),
        type: 'execution_failed',
        claim_id: claimId,
        payload: { job_id: safeEnvelope.job_id, reason: label }
      }
}

export function appendExecutionLifecycle(args) {
  const event = createExecutionLifecycleEvent(args)
  const pkg = validatePackageObject({
    schema_version: args.store.schemaVersion,
    package_id: args.store.packageId,
    events: [...args.store.events, event]
  })
  return Object.freeze({ store: createEventStore(pkg), event })
}

export function serializeEventStore(store) {
  if (!store || !Array.isArray(store.events)) throw new TypeError('A valid event store is required')
  return JSON.stringify({
    schema_version: store.schemaVersion,
    package_id: store.packageId,
    events: store.events
  }, null, 2) + '\n'
}
