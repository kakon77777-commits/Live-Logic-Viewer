export function createEventStore(pkg) {
  if (!pkg || !Object.isFrozen(pkg)) throw new TypeError('Event package must be validated and frozen before storage')
  return Object.freeze({
    schemaVersion: pkg.schema_version,
    packageId: pkg.package_id,
    createdAt: pkg.created_at ?? null,
    events: Object.freeze([...pkg.events]),
    length: pkg.events.length,
  })
}
