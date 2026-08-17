import { validatePackageObject } from './validate.js'

function canonicalUtc(value, label) {
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`)
  }
  return value
}

/**
 * Upgrade a validated v0.1 package to v0.2 without inventing history.
 * Every source event must receive an explicit occurred_at supplied by the caller.
 */
export function migratePackageV01ToV02(pkg, { createdAt, occurredAtByEventId } = {}) {
  const source = validatePackageObject(structuredClone(pkg))
  if (source.schema_version !== '0.1') {
    throw new Error(`Migration requires event package v0.1, received ${source.schema_version}`)
  }
  if (!occurredAtByEventId || typeof occurredAtByEventId !== 'object' || Array.isArray(occurredAtByEventId)) {
    throw new Error('Migration requires occurredAtByEventId for every source event')
  }
  const migratedEvents = source.events.map(event => {
    const occurredAt = occurredAtByEventId[event.event_id]
    if (typeof occurredAt !== 'string') {
      throw new Error(`Migration timestamp missing for event ${event.event_id}`)
    }
    return { ...structuredClone(event), occurred_at: canonicalUtc(occurredAt, `occurred_at for ${event.event_id}`) }
  })
  return validatePackageObject({
    schema_version:'0.2',
    package_id:source.package_id,
    created_at:canonicalUtc(createdAt, 'createdAt'),
    events:migratedEvents
  })
}
