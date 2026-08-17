function canonicalNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers')
  return JSON.stringify(value)
}

export function canonicalJson(value) {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') return canonicalNumber(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`)
}
