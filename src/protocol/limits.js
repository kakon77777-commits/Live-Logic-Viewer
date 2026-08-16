export const MAX_PACKAGE_BYTES = 256 * 1024
export const MAX_JSON_DEPTH = 32
export const MAX_TEX_LENGTH = 4096

export const FORBIDDEN_KEYS = new Set([
  'html', 'script', 'javascript', 'css', 'onclick', 'srcdoc', 'iframe',
  'eval', 'module', 'worker', 'wasm', 'shell', 'command',
])
