import { Sandbox } from '@cloudflare/sandbox'

/** Network denial is fixed at class startup time and is not derived from user input. */
export class LiveLogicSandbox extends Sandbox {
  enableInternet = false
}
