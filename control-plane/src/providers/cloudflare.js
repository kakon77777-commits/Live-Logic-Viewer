import { getSandbox } from '@cloudflare/sandbox'
import { createCloudflareProviderCore } from './cloudflare-core.js'

export function createCloudflareProvider(env) {
  return createCloudflareProviderCore(env, { getSandboxImpl: getSandbox })
}
