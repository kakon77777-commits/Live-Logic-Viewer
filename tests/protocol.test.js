import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAndValidatePackage, validatePackageObject } from '../src/protocol/validate.js'
const demo=()=>JSON.parse(readFileSync('examples/demo-events.json','utf8'))
describe('canonical protocol validation',()=>{
 it('accepts the golden package',()=>expect(validatePackageObject(demo()).events.length).toBeGreaterThan(0))
 it('rejects unknown fields',()=>{ const p=demo(); p.events[0].surprise=true; expect(()=>validatePackageObject(p)).toThrow(/Invalid event package/) })
 it('rejects forbidden nested fields',()=>{ const p=demo(); p.events[0].payload.html='<b>x</b>'; expect(()=>validatePackageObject(p)).toThrow(/Forbidden field/) })
 it('rejects oversized input before parse',()=>expect(()=>parseAndValidatePackage(' '.repeat(256*1024+1))).toThrow(/exceeds/))
 it('rejects deep JSON',()=>{ let v={}; let cur=v; for(let i=0;i<34;i++){cur.x={};cur=cur.x} expect(()=>validatePackageObject(v)).toThrow(/nesting/) })
})
