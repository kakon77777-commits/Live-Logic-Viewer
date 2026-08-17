import { describe, expect, it } from 'vitest'
import { canonicalizeExecutionResult } from '../src/canonicalize.js'
const request = { schema_version: '0.1', runner: 'python', source: 'print("ok")', network_policy: { mode: 'deny' }, limits: { wall_ms: 1000, output_bytes: 1024 } }
describe('canonical execution result', () => {
  it('caps combined stdout/stderr output', async () => { const value = await canonicalizeExecutionResult({ jobId: 'j1', request, raw: { provider: 'mock', stdout: 'a'.repeat(900), stderr: 'b'.repeat(900), exitCode: 0, timedOut: false }, wallMs: 4 }); const total = new TextEncoder().encode(value.result.stdout + value.result.stderr).byteLength; expect(total).toBeLessThanOrEqual(1024); expect(value.result.truncated).toBe(true) })
  it('reports timeout as execution failure rather than epistemic false', async () => { const value = await canonicalizeExecutionResult({ jobId: 'j2', request, raw: { provider: 'mock', stdout: '', stderr: '', exitCode: null, timedOut: true }, wallMs: 1000 }); expect(value.status).toBe('failed'); expect(value.execution.timed_out).toBe(true); expect(value).not.toHaveProperty('judgment') })
})
