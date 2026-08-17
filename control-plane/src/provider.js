/** Provider contract: executePython({ jobId, request }) -> { provider, stdout, stderr, exitCode, timedOut }. Provider implementations own sandbox lifecycle and must never return secrets. */
export function assertExecutionProvider(provider) {
  if (!provider || typeof provider.executePython !== 'function') throw new TypeError('execution provider must implement executePython(job)')
  return provider
}
