import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAndValidatePackage, validatePackageObject } from '../src/protocol/validate.js'

const demo = () => JSON.parse(readFileSync('examples/demo-events.json','utf8'))
const demoV02 = () => JSON.parse(readFileSync('examples/demo-events-v0.2.json','utf8'))

describe('canonical protocol validation',()=>{
  it('accepts the golden v0.1 package',()=>expect(validatePackageObject(demo()).events.length).toBeGreaterThan(0))
  it('accepts v0.2 with canonical wall-time metadata',()=>{
    const value=validatePackageObject(demoV02())
    expect(value.schema_version).toBe('0.2')
    expect(value.created_at).toBe('2026-08-17T06:30:00.000Z')
    expect(value.events[0].occurred_at).toMatch(/Z$/)
  })
  it('keeps sequence as canonical ordering even when occurred_at is not monotonic',()=>{
    const value=validatePackageObject(demoV02())
    expect(value.events.at(-1).sequence).toBe(6)
    expect(Date.parse(value.events.at(-1).occurred_at)).toBeLessThan(Date.parse(value.events[4].occurred_at))
  })
  it('rejects v0.2 without package creation time',()=>{
    const p=demoV02(); delete p.created_at
    expect(()=>validatePackageObject(p)).toThrow(/Invalid event package/)
  })
  it('rejects v0.2 events without occurred_at',()=>{
    const p=demoV02(); delete p.events[0].occurred_at
    expect(()=>validatePackageObject(p)).toThrow(/Invalid event package/)
  })
  it('rejects non-canonical v0.2 timestamps',()=>{
    const p=demoV02(); p.events[0].occurred_at='2026-08-17T14:30:00+08:00'
    expect(()=>validatePackageObject(p)).toThrow(/canonical UTC timestamp/i)
  })
  it('rejects unsupported package schema versions',()=>{
    const p=demo(); p.schema_version='0.3'
    expect(()=>validatePackageObject(p)).toThrow(/Unsupported event package schema_version/)
  })
  it('rejects unknown fields',()=>{const p=demo();p.events[0].surprise=true;expect(()=>validatePackageObject(p)).toThrow(/Invalid event package/)})
  it('rejects forbidden nested fields',()=>{const p=demo();p.events[0].payload.html='<b>x</b>';expect(()=>validatePackageObject(p)).toThrow(/Forbidden field/)})
  it('rejects oversized input before parse',()=>expect(()=>parseAndValidatePackage(' '.repeat(256*1024+1))).toThrow(/exceeds/))
  it('rejects an oversized in-memory derived package too',()=>{const p=demo();p.events[0].payload.statement='x'.repeat(256*1024);expect(()=>validatePackageObject(p)).toThrow(/exceeds/)})
  it('rejects deep JSON',()=>{let v={};let cur=v;for(let i=0;i<34;i++){cur.x={};cur=cur.x}expect(()=>validatePackageObject(v)).toThrow(/nesting/)})
})
