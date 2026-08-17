import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const workflow=()=>readFileSync('.github/workflows/ci.yml','utf8')

describe('CI supply-chain policy',()=>{
  it('pins every actions/* workflow dependency to a full commit SHA',()=>{
    const uses=[...workflow().matchAll(/uses:\s*(actions\/[A-Za-z0-9._-]+)@([^\s#]+)/g)]
    expect(uses.length).toBeGreaterThan(0)
    for(const[,name,ref]of uses)expect(ref,`${name} is not SHA-pinned: ${ref}`).toMatch(/^[0-9a-f]{40}$/)
  })

  it('does not restore mutable major-version action tags',()=>{
    expect(workflow()).not.toMatch(/uses:\s*actions\/[A-Za-z0-9._-]+@v\d+/)
  })
})
