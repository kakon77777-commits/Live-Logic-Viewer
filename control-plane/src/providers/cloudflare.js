import { getSandbox } from '@cloudflare/sandbox'
import { assertExecutionProvider } from '../provider.js'

function sandboxId(jobId) {
  const compact = String(jobId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  return `job-${compact || 'anonymous'}`
}

export function createCloudflareProvider(env, { getSandboxImpl = getSandbox } = {}) {
  if (!env?.Sandbox) throw new Error('Cloudflare Sandbox binding is not configured')
  if (typeof getSandboxImpl !== 'function') throw new TypeError('getSandboxImpl must be a function')

  return assertExecutionProvider({
    async executePython({ jobId, request }) {
      const sandbox = getSandboxImpl(env.Sandbox, sandboxId(jobId))
      try {
        // User source is data written to a fixed file. It is never interpolated
        // into argv or a shell command constructed by this control plane.
        await sandbox.writeFile('/workspace/main.py', request.source)
        const process = await sandbox.exec(
          ['python3', '/workspace/main.py'],
          { cwd: '/workspace', timeout: request.limits.wall_ms }
        )
        const output = await process.output({ encoding: 'utf8' })
        return {
          provider: 'cloudflare',
          stdout: String(output?.stdout ?? ''),
          stderr: String(output?.stderr ?? ''),
          exitCode: Number.isInteger(output?.exitCode) ? output.exitCode : null,
          timedOut: Boolean(output?.timedOut)
        }
      } finally {
        // Always tear down the whole sandbox. This is stricter than merely
        // disconnecting from a timed-out process and prevents cross-job reuse.
        try { await sandbox.destroy() } catch {}
      }
    }
  })
}
