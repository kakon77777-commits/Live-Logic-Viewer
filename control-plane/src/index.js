import { createApplication } from './app.js'
import { createCloudflareProvider } from './providers/cloudflare.js'

const handle = createApplication(createCloudflareProvider)
export default { fetch(request, env) { return handle(request, env) } }
export { LiveLogicSandbox } from './cloudflare-sandbox.js'
