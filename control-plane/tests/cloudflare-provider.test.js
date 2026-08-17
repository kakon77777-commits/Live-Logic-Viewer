import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCloudflareProviderCore, FIXED_PYTHON_COMMAND, SANDBOX_OPTIONS } from '../src/providers/cloudflare-core.js'

const request = {
  schema_version: '0.1',
  runner: 'python',
  source: 'print("USER SOURCE")',
  network_policy: { mode: 'deny' },
  limits: { wall_ms: 4321, output_bytes: 4096 }
}

function harness({ chunks = [['stdout', 'ok\n']], exitCode = 0, execError } = {}) {
  const destroy = vi.fn(async () => {})
  const writeFile = vi.fn(async () => {})
  const exec = vi.fn(async (_command, options) => {
    for (const [stream, data] of chunks) options.onOutput?.(stream, data)
    if (execError) throw execError
    return { exitCode }
  })
  const sandbox = { destroy, writeFile, exec }
  const getSandboxImpl = vi.fn(() => sandbox)
  return { destroy, writeFile, exec, getSandboxImpl }
}

afterEach(() => vi.useRealTimers())

describe('Cloudflare execution provider boundary', () => {
  it('uses an isolated default-session policy and a fixed scrubbed Python command', async () => {
    const h = harness()
    const binding = {}
    const provider = createCloudflareProviderCore({ Sandbox:binding, CONTROL_API_TOKEN:'must-not-enter-sandbox' }, { getSandboxImpl:h.getSandboxImpl })
    const result = await provider.executePython({ jobId:'ABC-123', request })

    expect(h.getSandboxImpl).toHaveBeenCalledWith(binding,'job-abc123',SANDBOX_OPTIONS)
    expect(SANDBOX_OPTIONS).toEqual({ enableDefaultSession:false })
    expect(h.writeFile).toHaveBeenCalledWith('/workspace/main.py', request.source)

    const [command, options] = h.exec.mock.calls[0]
    expect(command).toBe(FIXED_PYTHON_COMMAND)
    expect(command).toContain('/usr/bin/env -i')
    expect(command).toContain('PYTHONNOUSERSITE=1')
    expect(command).not.toContain('USER SOURCE')
    expect(command).not.toContain('must-not-enter-sandbox')
    expect(options.cwd).toBe('/workspace')
    expect(options.timeout).toBe(4571)
    expect(options.stream).toBe(true)
    expect(typeof options.onOutput).toBe('function')
    expect(result).toEqual({provider:'cloudflare',stdout:'ok\n',stderr:'',exitCode:0,timedOut:false,outputLimited:false})
    expect(h.destroy).toHaveBeenCalledOnce()
  })

  it('bounds combined output and destroys the sandbox on overflow', async () => {
    const h = harness({ chunks:[['stdout','a'.repeat(5000)],['stderr','ignored-after-limit']] })
    const provider = createCloudflareProviderCore({ Sandbox:{} }, { getSandboxImpl:h.getSandboxImpl })
    const result = await provider.executePython({ jobId:'job-output', request })
    expect(new TextEncoder().encode(result.stdout + result.stderr).byteLength).toBeLessThanOrEqual(4096)
    expect(result.outputLimited).toBe(true)
    expect(h.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the sandbox when execution throws normally', async () => {
    const h = harness({ execError:new Error('boom') })
    const provider = createCloudflareProviderCore({ Sandbox:{} }, { getSandboxImpl:h.getSandboxImpl })
    await expect(provider.executePython({ jobId:'job-error', request })).rejects.toThrow('boom')
    expect(h.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the whole sandbox at the wall-time deadline', async () => {
    vi.useFakeTimers()
    let rejectExec
    const destroy = vi.fn(async () => { rejectExec?.(new Error('sandbox destroyed')) })
    const sandbox = {
      destroy,
      writeFile: vi.fn(async () => {}),
      exec: vi.fn(() => new Promise((_resolve, reject) => { rejectExec = reject }))
    }
    const provider = createCloudflareProviderCore({ Sandbox:{} }, { getSandboxImpl:() => sandbox })
    const pending = provider.executePython({ jobId:'job-timeout', request })
    await vi.advanceTimersByTimeAsync(4321)
    const result = await pending
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBeNull()
    expect(result).not.toHaveProperty('judgment')
    expect(destroy).toHaveBeenCalledOnce()
  })
})
