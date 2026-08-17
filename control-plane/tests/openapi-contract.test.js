import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const spec=()=>readFileSync(new URL('../openapi.yaml',import.meta.url),'utf8')

describe('OpenAPI safety contract',()=>{
  it('documents liveness and readiness separately',()=>{
    const text=spec()
    expect(text).toContain('/health:')
    expect(text).toContain('/ready:')
    expect(text).toContain('Liveness only')
    expect(text).toContain('readiness report')
  })

  it('binds job request and result to the canonical schemas',()=>{
    const text=spec()
    expect(text).toContain("./schemas/execution-request.schema.json")
    expect(text).toContain("./schemas/execution-result.schema.json")
  })

  it('documents the fixed deny-only and non-evidence capabilities',()=>{
    const text=spec()
    expect(text).toContain('execution_result_is_evidence: { const: false }')
    expect(text).toContain('prefixItems: [{ const: deny }]')
    expect(text).toContain('ECDSA_P256_SHA256')
    expect(text).toContain('verification_keys:')
  })
})
