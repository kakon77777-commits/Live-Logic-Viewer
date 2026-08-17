export function createMockProvider(result = {}) {
  return {
    async executePython() {
      return { provider: 'mock', stdout: result.stdout ?? '2\n', stderr: result.stderr ?? '', exitCode: Number.isInteger(result.exitCode) ? result.exitCode : 0, timedOut: Boolean(result.timedOut) }
    }
  }
}
