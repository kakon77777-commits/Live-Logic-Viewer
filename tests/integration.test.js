import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAndValidatePackage } from '../src/protocol/validate.js'
import { createEventStore } from '../src/store/event-store.js'
import { projectAt } from '../src/projection/projector.js'
describe('secure viewer integration',()=>{
 it('loads the validated demo and reaches provisional false at Live',()=>{ const pkg=parseAndValidatePackage(readFileSync('examples/demo-events.json','utf8')); const s=createEventStore(pkg); expect(projectAt(s,s.length).judgments['weather-claim'].state).toBe('provisionally_false') })
 it('rejects an event carrying executable-looking fields before storage',()=>{ const p=JSON.parse(readFileSync('examples/demo-events.json','utf8')); p.events[0].payload.command='whoami'; expect(()=>parseAndValidatePackage(JSON.stringify(p))).toThrow(/Forbidden field/) })
})
