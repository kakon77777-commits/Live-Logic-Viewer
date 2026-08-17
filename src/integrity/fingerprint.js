import { canonicalJson } from '../../shared/canonical-json.js'
import { sha256Hex } from '../../shared/sha256.js'
import { projectAt } from '../projection/projector.js'

function packagePrefix(store,cursor) {
  const end=Math.max(0,Math.min(store.length,Math.trunc(Number(cursor) || 0)))
  const value={schema_version:store.schemaVersion,package_id:store.packageId,events:store.events.slice(0,end)}
  if(store.schemaVersion==='0.2')value.created_at=store.createdAt
  return value
}

export async function fingerprintReplay(store,cursor=store.length) {
  if(!store||!Array.isArray(store.events))throw new TypeError('A valid event store is required')
  const end=Math.max(0,Math.min(store.length,Math.trunc(Number(cursor) || 0)))
  const projection=projectAt(store,end)
  const[eventPrefixSha256,projectionSha256]=await Promise.all([
    sha256Hex(canonicalJson(packagePrefix(store,end))),
    sha256Hex(canonicalJson(projection))
  ])
  return Object.freeze({
    schema_version:'0.1',
    package_id:store.packageId,
    event_schema_version:store.schemaVersion,
    event_cursor:end,
    event_prefix_sha256:eventPrefixSha256,
    projection_sha256:projectionSha256
  })
}

export function serializeReplayFingerprint(value) {
  return `${JSON.stringify(value,null,2)}\n`
}
