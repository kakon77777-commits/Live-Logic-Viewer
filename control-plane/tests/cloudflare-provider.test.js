import { describe, expect, it, vi } from 'vitest'
import { createCloudflareProviderCore } from '../src/providers/cloudflare-core.js'

const request = {
  schema_version: '0.1',
  runner: 'python',
  source: 'print("USER SOURCE")',
  network_policy: { mode: 'deny' },
  limits: { wall_ms: 4321, output_bytes: 4096 }
}

function harness({ output, execError } = {}) {
  const destroy = vi.fn(async () => {})
  const writeFile = vi.fn(async () => {})
  const outputFn = vi.fn(async () => output ?? {
    stdout: 'ok\n', stderr: '', exitCode: 0, timedOut: false
  })
  const exec = vi.fn(async () => {
    if (execError) throw execError
    return { output: outputFn }
  })
  const sandbox = { destroy, writeFile, exec }
  const getSandboxImpl = vi.fn(() => sandbox)
  return { destroy, writeFile, outputFn, exec, getSandboxImpl }
}

describe('Cloudflare execution provider boundary', () => {
  it('writes user source to a fixed file and keeps it out of argv', async () => {
    const h = harness()
    const provider = createCloudflareProviderCore({ Sandbox: {} }, { getSandboxImpl: h.getSandboxImpl })
    const result = await provider.executePython({ jobId: 'ABC-123', request })

    expect(h.writeFile).toHaveBeenCalledWith('/workspace/main.py', request.source)
    expect(h.exec).toHaveBeenCalledWith(
      ['python3', '/workspace/main.py'],
      { cwd: '/workspace', timeout: 4321 }
    )
    expect(JSON.stringify(h.exec.mock.calls)).not.toContain('USER SOURCE')
    expect(result).toEqual({ provider:'cloudflare', stdout:'ok\n', stderr:'', exitCode:0, timedOut:false })
    expect(h.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the sandbox when execution throws', async () => {
    const h = harness({ execError: new Error('boom') })
    const provider = createCloudflareProviderCore({ Sandbox: {} }, { getSandboxImpl: h.getSandboxImpl })
    await expect(provider.executePython({ jobId:'job-2', request })).rejects.toThrow('boom')
    expect(h.destroy).toHaveBeenCalledOnce()
  })

  it('normalizes timeout/output metadata without inventing a judgment', async () => {
    const h = harness({ output: { stdout:'', stderr:'deadline', exitCode:null, timedOut:true } })
    const provider = createCloudflareProviderCore({ Sandbox: {} }, { getSandboxImpl: h.getSandboxImpl })
    const result = await provider.executePython({ jobId:'job-3', request })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBeNull()
    expect(result).not.toHaveProperty('judgment')
    expect(h.destroy).toHaveBeenCalledOnce()
  })
})
