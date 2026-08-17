import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validatePackageObject } from '../src/protocol/validate.js'
import { createEventStore } from '../src/store/event-store.js'
import { fingerprintReplay } from '../src/integrity/fingerprint.js'

function store(path='examples/demo-events.json') {
  return createEventStore(validatePackageObject(JSON.parse(readFileSync(path,'utf8'))))
}

describe('replay fingerprints',()=>{
  it('is deterministic for the same validated history and cursor',async()=>{
    const s=store();const a=await fingerprintReplay(s,5);const b=await fingerprintReplay(s,5)
    expect(a).toEqual(b)
    expect(a.event_prefix_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(a.projection_sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes the event-prefix and projection fingerprints when history advances',async()=>{
    const s=store();const before=await fingerprintReplay(s,5);const after=await fingerprintReplay(s,6)
    expect(after.event_prefix_sha256).not.toBe(before.event_prefix_sha256)
    expect(after.projection_sha256).not.toBe(before.projection_sha256)
  })

  it('records timestamped event schema version without using wall time as replay order',async()=>{
    const s=store('examples/demo-events-v0.2.json');const value=await fingerprintReplay(s,s.length)
    expect(value.event_schema_version).toBe('0.2')
    expect(value.event_cursor).toBe(6)
  })

  it('does not mutate the immutable store while hashing',async()=>{
    const s=store();const before=JSON.stringify(s.events);await fingerprintReplay(s,3);expect(JSON.stringify(s.events)).toBe(before)
  })
})
