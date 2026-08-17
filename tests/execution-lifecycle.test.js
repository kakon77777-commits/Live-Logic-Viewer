import { describe, expect, it } from 'vitest'
import { validatePackageObject } from '../src/protocol/validate.js'
import { createEventStore } from '../src/store/event-store.js'
import { projectAt } from '../src/projection/projector.js'
import { appendExecutionLifecycle, serializeEventStore } from '../src/execution/lifecycle.js'

function store() {
  return createEventStore(validatePackageObject({
    schema_version: '0.1',
    package_id: 'lifecycle-test',
    events: [
      {
        event_id: 'e1', sequence: 1, type: 'claim_created', claim_id: 'c1',
        payload: { statement: 'Claim under test' }
      },
      {
        event_id: 'e2', sequence: 2, type: 'judgment_transition', claim_id: 'c1',
        payload: { from: 'open', to: 'provisionally_true', reason: 'Existing evidence' }
      }
    ]
  }))
}

function result(overrides = {}) {
  return {
    schema_version: '0.1',
    job_id: 'job-1',
    status: 'completed',
    execution: { provider:'mock', runner:'python', exit_code:0, timed_out:false, wall_ms:12 },
    result: { type:'text', stdout:'<script>never render me</script>', stderr:'', truncated:false },
    provenance: { request_sha256:'1'.repeat(64), source_sha256:'2'.repeat(64) },
    ...overrides
  }
}

describe('explicit execution lifecycle bridge', () => {
  it('records completion without changing evidence or judgment', () => {
    const before = store()
    const beforeState = projectAt(before)
    const { store: after, event } = appendExecutionLifecycle({
      store: before,
      envelope: result(),
      claimId: 'c1',
      eventIdFactory: () => 'fixed-id'
    })
    const afterState = projectAt(after)

    expect(event.type).toBe('execution_completed')
    expect(after.length).toBe(before.length + 1)
    expect(afterState.execution.c1.status).toBe('completed')
    expect(afterState.judgments.c1).toEqual(beforeState.judgments.c1)
    expect(afterState.evidence.c1).toEqual(beforeState.evidence.c1)
    expect(event.payload.summary).not.toContain('<script>')
  })

  it('records failure as execution metadata rather than epistemic false', () => {
    const before = store()
    const { store: after, event } = appendExecutionLifecycle({
      store: before,
      envelope: result({
        status: 'failed',
        execution: { provider:'mock', runner:'python', exit_code:null, timed_out:true, wall_ms:5000 }
      }),
      claimId: 'c1',
      eventIdFactory: () => 'failed-id'
    })
    const state = projectAt(after)
    expect(event.type).toBe('execution_failed')
    expect(state.execution.c1.status).toBe('failed')
    expect(state.judgments.c1.state).toBe('provisionally_true')
    expect(state.judgments.c1.projection).toBe('true')
  })

  it('rejects recording against an unknown claim', () => {
    expect(() => appendExecutionLifecycle({
      store: store(), envelope: result(), claimId: 'missing', eventIdFactory: () => 'x'
    })).toThrow(/Unknown claim/)
  })

  it('serializes the derived session as a canonical event package', () => {
    const { store: after } = appendExecutionLifecycle({
      store: store(), envelope: result(), claimId: 'c1', eventIdFactory: () => 'export-id'
    })
    const exported = JSON.parse(serializeEventStore(after))
    expect(exported.schema_version).toBe('0.1')
    expect(exported.events.at(-1).type).toBe('execution_completed')
    expect(exported.events.at(-1).payload).not.toHaveProperty('stdout')
  })
})
