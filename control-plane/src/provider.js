/** Provider contract: executePython({ jobId, request }) -> { provider, stdout, stderr, exitCode, timedOut, outputLimited? }. Provider implementations own sandbox lifecycle and must never return secrets. */
export function assertExecutionProvider(provider) {
  if (!provider || typeof provider.executePython !== 'function') throw new TypeError('execution provider must implement executePython(job)')
  return provider
}

export function validateProviderRawResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('provider result must be an object')
  const allowed = new Set(['provider','stdout','stderr','exitCode','timedOut','outputLimited'])
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`provider result: unknown field "${key}"`)
  if (typeof value.provider !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(value.provider)) throw new TypeError('provider result.provider is invalid')
  if (typeof value.stdout !== 'string') throw new TypeError('provider result.stdout must be a string')
  if (typeof value.stderr !== 'string') throw new TypeError('provider result.stderr must be a string')
  if (!(value.exitCode === null || Number.isInteger(value.exitCode))) throw new TypeError('provider result.exitCode must be an integer or null')
  if (typeof value.timedOut !== 'boolean') throw new TypeError('provider result.timedOut must be boolean')
  if ('outputLimited' in value && typeof value.outputLimited !== 'boolean') throw new TypeError('provider result.outputLimited must be boolean')
  return Object.freeze({
    provider: value.provider,
    stdout: value.stdout,
    stderr: value.stderr,
    exitCode: value.exitCode,
    timedOut: value.timedOut,
    outputLimited: Boolean(value.outputLimited)
  })
}
