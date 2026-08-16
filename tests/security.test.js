import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
function filesUnder(path) { const out=[]; for (const name of readdirSync(path)) { const full=join(path,name); statSync(full).isDirectory()?out.push(...filesUnder(full)):out.push(full) } return out }
describe('viewer security invariants', () => {
  it('contains no arbitrary execution primitives', () => {
    const text=[...filesUnder('src'),'index.html'].map(p=>readFileSync(p,'utf8')).join('\n')
    for (const forbidden of [/\beval\s*\(/,/\bnew\s+Function\s*\(/,/WebAssembly\./,/navigator\.serviceWorker\.register/,/child_process/,/execSync\s*\(/,/spawn\s*\(/]) expect(text).not.toMatch(forbidden)
  })
  it('contains no raw runtime HTML sinks', () => {
    const text=filesUnder('src').map(p=>readFileSync(p,'utf8')).join('\n')
    for (const forbidden of [/\.innerHTML\s*=/,/\.outerHTML\s*=/,/insertAdjacentHTML\s*\(/,/srcdoc\s*=/]) expect(text).not.toMatch(forbidden)
  })
  it('ships a CSP without unsafe-eval', () => { const html=readFileSync('index.html','utf8'); expect(html).toContain("object-src 'none'"); expect(html).toContain("frame-src 'none'"); expect(html).toContain("worker-src 'none'"); expect(html).not.toContain("'unsafe-eval'") })
})
