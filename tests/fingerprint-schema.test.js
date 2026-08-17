import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../schemas/replay-fingerprint.schema.json'
import { readFileSync } from 'node:fs'
import { validatePackageObject } from '../src/protocol/validate.js'
import { createEventStore } from '../src/store/event-store.js'
import { fingerprintReplay } from '../src/integrity/fingerprint.js'

const ajv=new Ajv2020({allErrors:true,strict:true})
const validate=ajv.compile(schema)

describe('replay fingerprint schema',()=>{
  it('accepts the deterministic Viewer fingerprint output',async()=>{
    const pkg=validatePackageObject(JSON.parse(readFileSync('examples/demo-events-v0.2.json','utf8')))
    const value=await fingerprintReplay(createEventStore(pkg),3)
    expect(validate(value),JSON.stringify(validate.errors)).toBe(true)
  })

  it('rejects unknown fields and malformed hashes',async()=>{
    const pkg=validatePackageObject(JSON.parse(readFileSync('examples/demo-events.json','utf8')))
    const value=await fingerprintReplay(createEventStore(pkg),2)
    expect(validate({...value,extra:true})).toBe(false)
    expect(validate({...value,event_prefix_sha256:'not-a-hash'})).toBe(false)
  })
})
