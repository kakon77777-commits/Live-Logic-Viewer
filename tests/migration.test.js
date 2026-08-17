import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { migratePackageV01ToV02 } from '../src/protocol/migrate.js'

const source=()=>JSON.parse(readFileSync('examples/demo-events.json','utf8'))
function mapping(pkg){return Object.fromEntries(pkg.events.map((event,index)=>[event.event_id,new Date(Date.UTC(2026,7,17,7,0,index)).toISOString()]))}

describe('event package v0.1 to v0.2 migration',()=>{
  it('upgrades only when every historical event timestamp is supplied explicitly',()=>{
    const pkg=source();const migrated=migratePackageV01ToV02(pkg,{createdAt:'2026-08-17T07:30:00.000Z',occurredAtByEventId:mapping(pkg)})
    expect(migrated.schema_version).toBe('0.2')
    expect(migrated.created_at).toBe('2026-08-17T07:30:00.000Z')
    expect(migrated.events).toHaveLength(pkg.events.length)
    expect(migrated.events[0].occurred_at).toBe('2026-08-17T07:00:00.000Z')
  })

  it('refuses to invent a missing event timestamp',()=>{
    const pkg=source();const times=mapping(pkg);delete times[pkg.events[3].event_id]
    expect(()=>migratePackageV01ToV02(pkg,{createdAt:'2026-08-17T07:30:00.000Z',occurredAtByEventId:times})).toThrow(/timestamp missing/i)
  })

  it('refuses non-canonical local-offset timestamps',()=>{
    const pkg=source();const times=mapping(pkg);times[pkg.events[0].event_id]='2026-08-17T15:00:00+08:00'
    expect(()=>migratePackageV01ToV02(pkg,{createdAt:'2026-08-17T07:30:00.000Z',occurredAtByEventId:times})).toThrow(/canonical UTC/i)
  })

  it('does not mutate the source package',()=>{
    const pkg=source();const before=JSON.stringify(pkg);migratePackageV01ToV02(pkg,{createdAt:'2026-08-17T07:30:00.000Z',occurredAtByEventId:mapping(pkg)});expect(JSON.stringify(pkg)).toBe(before)
  })
})
