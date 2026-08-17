export class ProjectionError extends Error {
  constructor(message) { super(message); this.name = 'ProjectionError' }
}

const projection = state => state === 'provisionally_true' ? 'true' : state === 'provisionally_false' ? 'false' : 'omega'
function clone(value) { return structuredClone(value) }
function ensureClaim(state, claimId) { if (!state.claims[claimId]) throw new ProjectionError(`Unknown claim: ${claimId}`) }

export function projectAt(store, cursor = store.length) {
  const end = Math.max(0, Math.min(store.length, Math.trunc(Number(cursor) || 0)))
  const state = { cursor:end, package_created_at:store.createdAt ?? null, claims:{}, evidence:{}, judgments:{}, metrics:{}, formulas:{}, execution:{}, timeline:[] }
  for (const event of store.events.slice(0, end)) {
    const id = event.claim_id
    switch (event.type) {
      case 'claim_created':
        if (state.claims[id]) throw new ProjectionError(`Duplicate claim creation: ${id}`)
        state.claims[id] = { statement:event.payload.statement }
        state.evidence[id] = []
        state.judgments[id] = { state:'open', projection:'omega', reason:'Claim created' }
        state.metrics[id] = {}
        state.formulas[id] = {}
        state.execution[id] = { status:'idle', detail:null }
        break
      case 'evidence_added':
        ensureClaim(state,id); state.evidence[id].push({ ...clone(event.payload), invalidated:false }); break
      case 'evidence_invalidated': {
        ensureClaim(state,id); const item=state.evidence[id].find(e=>e.evidence_id===event.payload.evidence_id); if(!item)throw new ProjectionError(`Unknown evidence: ${event.payload.evidence_id}`); item.invalidated=true; item.invalidation_reason=event.payload.reason; break
      }
      case 'judgment_transition': {
        ensureClaim(state,id); const current=state.judgments[id].state; if(current!==event.payload.from)throw new ProjectionError(`Judgment history mismatch for ${id}: expected ${current}, event says ${event.payload.from}`); state.judgments[id]={state:event.payload.to,projection:projection(event.payload.to),reason:event.payload.reason}; break
      }
      case 'metric_update': {
        ensureClaim(state,id); const current=state.metrics[id][event.payload.field]??null; if(current!==event.payload.from)throw new ProjectionError(`Metric history mismatch for ${id}.${event.payload.field}`); state.metrics[id][event.payload.field]=event.payload.to; break
      }
      case 'formula_projection': ensureClaim(state,id); state.formulas[id][event.payload.formula_id]=clone(event.payload); break
      case 'timeline_marker': ensureClaim(state,id); break
      case 'execution_completed': ensureClaim(state,id); state.execution[id]={status:'completed',detail:event.payload.summary,job_id:event.payload.job_id}; break
      case 'execution_failed': ensureClaim(state,id); state.execution[id]={status:'failed',detail:event.payload.reason,job_id:event.payload.job_id}; break
      default: throw new ProjectionError(`Unsupported event type: ${event.type}`)
    }
    state.timeline.push({
      event_id:event.event_id,
      sequence:event.sequence,
      occurred_at:event.occurred_at ?? null,
      type:event.type,
      claim_id:id,
      label:event.payload.label || event.payload.reason || event.payload.summary || event.payload.statement || event.type
    })
  }
  return state
}
