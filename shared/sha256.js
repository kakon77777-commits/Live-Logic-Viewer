function bytes(text) { return new TextEncoder().encode(String(text)) }
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', bytes(text))
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
}
