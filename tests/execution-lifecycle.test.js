import { describe, expect, it } from 'vitest'
import { validatePackageObject } from '../src/protocol/validate.js'
import { createEventStore } from '../src/store/event-store.js'
import { projectAt } from '../src/projection/projector.js'
import { appendExecutionLifecycle, serializeEventStore } from '../src/execution/lifecycle.js'

function store() {
  return createEventStore(validatePackageObject({
    schema_version:'0.1',
    package_id:'lifecycle-test',
    events:[
      {event_id:'e1',sequence:1,type:'claim_created',claim_id:'c1',payload:{statement:'Claim under test'}},
      {event_id:'e2',sequence:2,type:'judgment_transition',claim_id:'c1',payload:{from:'open',to:'provisionally_true',reason:'Existing evidence'}}
    ]
  }))
}

function storeV02() {
  return createEventStore(validatePackageObject({
    schema_version:'0.2',
    package_id:'lifecycle-test-v02',
    created_at:'2026-08-17T06:00:00.000Z',
    events:[
      {event_id:'e1',sequence:1,occurred_at:'2026-08-17T06:00:00.000Z',type:'claim_created',claim_id:'c1',payload:{statement:'Claim under test'}},
      {event_id:'e2',sequence:2,occurred_at:'2026-08-17T06:01:00.000Z',type:'judgment_transition',claim_id:'c1',payload:{from:'open',to:'provisionally_true',reason:'Existing evidence'}}
    ]
  }))
}

function result(overrides={}) {
  return {
    schema_version:'0.1',
    job_id:'job-1',
    status:'completed',
    execution:{provider:'mock',runner:'python',exit_code:0,timed_out:false,wall_ms:12},
    result:{type:'text',stdout:'<script>never render me</script>',stderr:'',truncated:false},
    provenance:{request_sha256:'1'.repeat(64),source_sha256:'2'.repeat(64)},
    ...overrides
  }
}

function auditedResult(overrides={}) {
  return result({
    request_id:'req-lifecycle-01234567',
    received_at:'2026-08-17T06:02:00.000Z',
    completed_at:'2026-08-17T06:02:00.012Z',
    integrity:{algorithm:'ECDSA_P256_SHA256',payload_version:'2',key_id:'prod-key',signature:'A'.repeat(86)},
    ...overrides
  })
}

describe('explicit execution lifecycle bridge',()=>{
  it('records completion without changing evidence or judgment',()=>{
    const before=store();const beforeState=projectAt(before)
    const {store:after,event}=appendExecutionLifecycle({store:before,envelope:result(),claimId:'c1',eventIdFactory:()=> 'fixed-id'})
    const afterState=projectAt(after)
    expect(event.type).toBe('execution_completed')
    expect(after.length).toBe(before.length+1)
    expect(afterState.execution.c1.status).toBe('completed')
    expect(afterState.judgments.c1).toEqual(beforeState.judgments.c1)
    expect(afterState.evidence.c1).toEqual(beforeState.evidence.c1)
    expect(event.payload.summary).not.toContain('<script>')
  })

  it('records failure as execution metadata rather than epistemic false',()=>{
    const before=store()
    const {store:after,event}=appendExecutionLifecycle({store:before,envelope:result({status:'failed',execution:{provider:'mock',runner:'python',exit_code:null,timed_out:true,wall_ms:5000}}),claimId:'c1',eventIdFactory:()=> 'failed-id'})
    const state=projectAt(after)
    expect(event.type).toBe('execution_failed')
    expect(state.execution.c1.status).toBe('failed')
    expect(state.judgments.c1.state).toBe('provisionally_true')
    expect(state.judgments.c1.projection).toBe('true')
  })

  it('records v0.2 wall-time and verified execution provenance without stdout',()=>{
    const {store:after,event}=appendExecutionLifecycle({
      store:storeV02(),
      envelope:auditedResult(),
      claimId:'c1',
      integrityStatus:'verified',
      eventIdFactory:()=> 'v02-id',
      nowFactory:()=>new Date('2026-08-17T06:03:00.000Z')
    })
    expect(event.occurred_at).toBe('2026-08-17T06:02:00.012Z')
    expect(event.payload.request_id).toBe('req-lifecycle-01234567')
    expect(event.payload.execution_completed_at).toBe('2026-08-17T06:02:00.012Z')
    expect(event.payload.recorded_at).toBe('2026-08-17T06:03:00.000Z')
    expect(event.payload.integrity_status).toBe('verified')
    expect(event.payload.signing_key_id).toBe('prod-key')
    expect(event.payload).not.toHaveProperty('stdout')
    expect(after.createdAt).toBe('2026-08-17T06:00:00.000Z')
    const projected=projectAt(after)
    expect(projected.timeline.at(-1).occurred_at).toBe('2026-08-17T06:02:00.012Z')
    expect(projected.judgments.c1.state).toBe('provisionally_true')
  })

  it('keeps v0.1 lifecycle serialization unchanged',()=>{
    const {store:after,event}=appendExecutionLifecycle({store:store(),envelope:result(),claimId:'c1',integrityStatus:'verified',eventIdFactory:()=> 'legacy-id',nowFactory:()=>new Date('2026-08-17T06:03:00.000Z')})
    expect(event).not.toHaveProperty('occurred_at')
    expect(event.payload).not.toHaveProperty('integrity_status')
    const exported=JSON.parse(serializeEventStore(after))
    expect(exported.schema_version).toBe('0.1')
    expect(exported).not.toHaveProperty('created_at')
  })

  it('rejects recording against an unknown claim',()=>{
    expect(()=>appendExecutionLifecycle({store:store(),envelope:result(),claimId:'missing',eventIdFactory:()=> 'x'})).toThrow(/Unknown claim/)
  })

  it('serializes the derived session as a canonical event package',()=>{
    const {store:after}=appendExecutionLifecycle({store:store(),envelope:result(),claimId:'c1',eventIdFactory:()=> 'export-id'})
    const exported=JSON.parse(serializeEventStore(after))
    expect(exported.schema_version).toBe('0.1')
    expect(exported.events.at(-1).type).toBe('execution_completed')
    expect(exported.events.at(-1).payload).not.toHaveProperty('stdout')
  })
})
