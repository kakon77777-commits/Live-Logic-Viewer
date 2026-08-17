import { assertExecutionProvider } from '../provider.js'

function sandboxId(jobId) {
  const compact = String(jobId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  return `job-${compact || 'anonymous'}`
}

export function createCloudflareProviderCore(env, { getSandboxImpl }) {
  if (!env?.Sandbox) throw new Error('Cloudflare Sandbox binding is not configured')
  if (typeof getSandboxImpl !== 'function') throw new TypeError('getSandboxImpl must be a function')

  return assertExecutionProvider({
    async executePython({ jobId, request }) {
      const sandbox = getSandboxImpl(env.Sandbox, sandboxId(jobId))
      try {
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
        try { await sandbox.destroy() } catch {}
      }
    }
  })
}
