import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createEventStore } from '../src/store/event-store.js'
import { projectAt } from '../src/projection/projector.js'
function freeze(v){ if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)} return v }
const pkg=freeze(JSON.parse(readFileSync(new URL('../examples/demo-events.json',import.meta.url),'utf8')))
const store=createEventStore(pkg)
assert.equal(projectAt(store,1).judgments['weather-claim'].projection,'omega')
assert.equal(projectAt(store,6).judgments['weather-claim'].state,'provisionally_true')
assert.equal(projectAt(store,10).judgments['weather-claim'].projection,'omega')
assert.equal(projectAt(store,14).judgments['weather-claim'].state,'provisionally_false')
assert.deepEqual(projectAt(store,9),projectAt(store,9))
console.log('Live Logic Viewer core replay verification: OK')
