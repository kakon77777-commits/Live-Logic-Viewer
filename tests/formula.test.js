import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateFormulaProjection } from '../src/renderer/formula.js'
describe('formula policy',()=>{
 it('accepts scalar presentation data',()=>expect(validateFormulaProjection({tex:'S_t=0.7',value:0.7}).value).toBe(0.7))
 it('rejects oversized TeX and non-scalar values',()=>{ expect(()=>validateFormulaProjection({tex:'x'.repeat(4097),value:1})).toThrow(); expect(()=>validateFormulaProjection({tex:'x',value:{x:1}})).toThrow() })
 it('hard-codes KaTeX trust false',()=>expect(readFileSync('src/renderer/formula.js','utf8')).toContain('trust: false'))
})
