import { describe, expect, it, vi } from 'vitest'
import { EXECUTION_ENDPOINT, submitRemoteExecution } from '../src/execution/client.js'
import { buildExecutionRequest, canonicalExecutionRequest } from '../shared/execution-request.js'
import { sha256Hex } from '../shared/sha256.js'

const capabilities = () => ({
  schema_version: '0.1',
  runners: ['python'],
  network_policies: ['deny'],
  limits: {
    max_source_bytes: 65536,
    min_wall_ms: 100,
    max_wall_ms: 10000,
    min_output_bytes: 1024,
    max_output_bytes: 65536
  },
  execution_result_is_evidence: false
})

async function resultFor(source, overrides = {}) {
  const request = buildExecutionRequest(source, { wall_ms: 5000, output_bytes: 65536 })
  return {
    schema_version: '0.1',
    job_id: 'j1',
    status: 'completed',
    execution: { provider:'mock', runner:'python', exit_code:0, timed_out:false, wall_ms:2 },
    result: { type:'text', stdout:'2\n', stderr:'', truncated:false },
    provenance: {
      source_sha256: await sha256Hex(source),
      request_sha256: await sha256Hex(canonicalExecutionRequest(request))
    },
    ...overrides
  }
}

describe('remote execution client', () => {
  it('uses fixed same-origin endpoint, network deny, capability limits, and verifies provenance', async () => {
    const source = 'print(1+1)'
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe('/v1/jobs')
      const body = JSON.parse(init.body)
      expect(body.network_policy).toEqual({ mode:'deny' })
      expect(body.runner).toBe('python')
      expect(body.limits).toEqual({ wall_ms:5000, output_bytes:65536 })
      return new Response(JSON.stringify(await resultFor(source)), { status:200 })
    })
    expect((await submitRemoteExecution({
      source,
      accessToken:'0123456789abcdef',
      capabilities:capabilities(),
      fetchImpl
    })).status).toBe('completed')
  })

  it('fails before fetch when capabilities are missing', async () => {
    const fetchImpl = vi.fn()
    await expect(submitRemoteExecution({
      source:'print(1)',
      accessToken:'0123456789abcdef',
      fetchImpl
    })).rejects.toThrow(/capabilities/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a result for a different source', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(await resultFor('print(999)')), { status:200 }))
    await expect(submitRemoteExecution({
      source:'print(1)', accessToken:'0123456789abcdef', capabilities:capabilities(), fetchImpl
    })).rejects.toThrow(/source provenance mismatch/i)
  })

  it('rejects a result with a mismatched canonical request hash', async () => {
    const source='print(1)'
    const value=await resultFor(source)
    value.provenance.request_sha256='0'.repeat(64)
    await expect(submitRemoteExecution({
      source, accessToken:'0123456789abcdef', capabilities:capabilities(),
      fetchImpl:async()=>new Response(JSON.stringify(value),{status:200})
    })).rejects.toThrow(/request provenance mismatch/i)
  })

  it('never accepts a caller-supplied execution endpoint', () => {
    expect(EXECUTION_ENDPOINT).toBe('/v1/jobs')
  })
})
