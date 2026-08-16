import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createEventStore } from '../src/store/event-store.js'
import { projectAt } from '../src/projection/projector.js'
const deepFreeze=v=>{ if(v&&typeof v==='object'){Object.values(v).forEach(deepFreeze);Object.freeze(v)};return v }
const store=()=>createEventStore(deepFreeze(JSON.parse(readFileSync('examples/demo-events.json','utf8'))))
describe('deterministic projection',()=>{
 it('replays the expected judgment closures',()=>{ const s=store(); expect(projectAt(s,1).judgments['weather-claim'].projection).toBe('omega'); expect(projectAt(s,6).judgments['weather-claim'].state).toBe('provisionally_true'); expect(projectAt(s,10).judgments['weather-claim'].projection).toBe('omega'); expect(projectAt(s,14).judgments['weather-claim'].state).toBe('provisionally_false') })
 it('is deterministic at the same cursor',()=>{ const s=store(); expect(projectAt(s,9)).toEqual(projectAt(s,9)) })
})
