import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { MIN_ACCESS_TOKEN_CHARACTERS, submitRemoteExecution } from '../src/execution/client.js'

const capabilities=()=>({schema_version:'0.1',runners:['python'],network_policies:['deny'],limits:{max_source_bytes:65536,min_wall_ms:100,max_wall_ms:10000,min_output_bytes:1024,max_output_bytes:65536},execution_result_is_evidence:false,result_integrity:{required:false,algorithm:'ECDSA_P256_SHA256',key_id:null,public_jwk:null,verification_keys:[]}})

describe('browser execution authorization minimum',()=>{
  it('requires at least 32 token characters before any network request',async()=>{
    expect(MIN_ACCESS_TOKEN_CHARACTERS).toBe(32)
    const fetchImpl=vi.fn()
    await expect(submitRemoteExecution({source:'print(1)',accessToken:'0123456789abcdef',capabilities:capabilities(),fetchImpl})).rejects.toThrow(/at least 32 characters/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps the HTML form minimum aligned with the client contract',()=>{
    expect(readFileSync('index.html','utf8')).toContain('id="remote-token" type="password" autocomplete="off" minlength="32"')
  })
})
