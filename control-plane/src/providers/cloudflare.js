import { getSandbox } from '@cloudflare/sandbox'
import { assertExecutionProvider } from '../provider.js'

function sandboxId(jobId) {
  const compact = String(jobId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  return `job-${compact || 'anonymous'}`
}

function byteLength(text) {
  return new TextEncoder().encode(String(text)).byteLength
}

function takeUtf8Prefix(text, maxBytes) {
  const source = String(text ?? '')
  if (maxBytes <= 0) return { text: '', truncated: source.length > 0 }
  if (byteLength(source) <= maxBytes) return { text: source, truncated: false }

  const points = [...source]
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (byteLength(points.slice(0, mid).join('')) <= maxBytes) lo = mid
    else hi = mid - 1
  }
  return { text: points.slice(0, lo).join(''), truncated: true }
}

export function createCloudflareProvider(env, { getSandboxImpl = getSandbox } = {}) {
  if (!env?.Sandbox) throw new Error('Cloudflare Sandbox binding is not configured')
  if (typeof getSandboxImpl !== 'function') throw new TypeError('getSandboxImpl must be a function')

  return assertExecutionProvider({
    async executePython({ jobId, request }) {
      const sandbox = getSandboxImpl(env.Sandbox, sandboxId(jobId))
      const cap = request.limits.output_bytes
      let stdout = ''
      let stderr = ''
      let usedBytes = 0
      let outputLimited = false
      let timedOut = false
      let destroyPromise = null

      const destroyOnce = () => {
        if (!destroyPromise) {
          destroyPromise = Promise.resolve()
            .then(() => sandbox.destroy())
            .catch(() => {})
        }
        return destroyPromise
      }

      const appendOutput = (stream, data) => {
        if (outputLimited) return
        const remaining = Math.max(0, cap - usedBytes)
        const piece = takeUtf8Prefix(data, remaining)
        if (stream === 'stderr') stderr += piece.text
        else stdout += piece.text
        usedBytes += byteLength(piece.text)

        if (piece.truncated) {
          outputLimited = true
          // Do not merely stop reading. Destroy the execution environment so
          // a program cannot continue producing unbounded output in the
          // background after the Viewer-facing cap has been reached.
          void destroyOnce()
        }
      }

      // The SDK timeout closes the caller connection while a timed-out process
      // may continue inside the container. Use our own deadline to destroy the
      // whole sandbox first, with the SDK timeout as a secondary guard.
      const deadline = setTimeout(() => {
        timedOut = true
        void destroyOnce()
      }, request.limits.wall_ms)

      try {
        await sandbox.writeFile('/workspace/main.py', request.source)

        // This command string is fixed by the control plane; no user value is
        // interpolated into it. Streaming prevents large stdout/stderr from
        // being accumulated unboundedly before our output cap is enforced.
        const result = await sandbox.exec('python3 /workspace/main.py', {
          cwd: '/workspace',
          timeout: request.limits.wall_ms + 250,
          stream: true,
          onOutput: appendOutput
        })

        return {
          provider: 'cloudflare',
          stdout,
          stderr,
          exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : null,
          timedOut,
          outputLimited
        }
      } catch (error) {
        if (timedOut || outputLimited) {
          return {
            provider: 'cloudflare',
            stdout,
            stderr,
            exitCode: null,
            timedOut,
            outputLimited
          }
        }
        throw error
      } finally {
        clearTimeout(deadline)
        // One job = one sandbox. Success, timeout, overflow, and provider error
        // all converge on full teardown so no process/filesystem is reused.
        await destroyOnce()
      }
    }
  })
}
