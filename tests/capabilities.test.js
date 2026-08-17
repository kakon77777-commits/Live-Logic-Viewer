import { describe, expect, it, vi } from 'vitest'
import {
  CAPABILITIES_ENDPOINT,
  fetchExecutionCapabilities,
  safeExecutionLimits,
  validateExecutionCapabilities
} from '../src/execution/capabilities.js'

const safe=()=>({schema_version:'0.1',runners:['python'],network_policies:['deny'],limits:{max_source_bytes:65536,min_wall_ms:100,max_wall_ms:10000,min_output_bytes:1024,max_output_bytes:65536},execution_result_is_evidence:false,result_integrity:{required:false,algorithm:'ECDSA_P256_SHA256',key_id:null,public_jwk:null,verification_keys:[]}})
const publicJwk={kty:'EC',crv:'P-256',x:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',y:'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'}
const previousJwk={kty:'EC',crv:'P-256',x:'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',y:'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'}

describe('control-plane capabilities handshake',()=>{
  it('accepts only the narrow v0.1 capability contract',()=>{const value=validateExecutionCapabilities(safe());expect(value.runners).toEqual(['python']);expect(value.network_policies).toEqual(['deny']);expect(value.result_integrity.verification_keys).toEqual([]);expect(safeExecutionLimits(value)).toEqual({max_source_bytes:65536,wall_ms:5000,output_bytes:65536})})
  it('accepts a required P-256 result-signing contract',()=>{const value=safe();value.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'prod-2026-01',public_jwk:publicJwk,verification_keys:[{key_id:'prod-2026-01',public_jwk:publicJwk}]};expect(validateExecutionCapabilities(value).result_integrity.required).toBe(true)})
  it('accepts a bounded active + previous verification keyring',()=>{const value=safe();value.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'active',public_jwk:publicJwk,verification_keys:[{key_id:'active',public_jwk:publicJwk},{key_id:'previous',public_jwk:previousJwk}]};expect(validateExecutionCapabilities(value).result_integrity.verification_keys.map(x=>x.key_id)).toEqual(['active','previous'])})
  it('rejects required signing without a public key',()=>{const value=safe();value.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'prod',public_jwk:null,verification_keys:[]};expect(()=>validateExecutionCapabilities(value)).toThrow(/public_jwk|object/i)})
  it('rejects a rotation keyring that omits or changes the active key',()=>{const missing=safe();missing.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'active',public_jwk:publicJwk,verification_keys:[{key_id:'previous',public_jwk:previousJwk}]};expect(()=>validateExecutionCapabilities(missing)).toThrow(/active result signing key/i);const changed=safe();changed.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'active',public_jwk:publicJwk,verification_keys:[{key_id:'active',public_jwk:previousJwk}]};expect(()=>validateExecutionCapabilities(changed)).toThrow(/active result signing key/i)})
  it('rejects duplicate verification key ids',()=>{const value=safe();value.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'active',public_jwk:publicJwk,verification_keys:[{key_id:'active',public_jwk:publicJwk},{key_id:'active',public_jwk:publicJwk}]};expect(()=>validateExecutionCapabilities(value)).toThrow(/duplicate/i)})
  it('rejects additional executable runners',()=>{const value=safe();value.runners.push('node');expect(()=>validateExecutionCapabilities(value)).toThrow(/python runner/i)})
  it('rejects any network policy broader than deny',()=>{const value=safe();value.network_policies=['deny','allowlist'];expect(()=>validateExecutionCapabilities(value)).toThrow(/network deny/i)})
  it('rejects a server that declares execution results as evidence',()=>{const value=safe();value.execution_result_is_evidence=true;expect(()=>validateExecutionCapabilities(value)).toThrow(/must not be declared evidence/i)})
  it('rejects broader source/runtime/output limits',()=>{const source=safe();source.limits.max_source_bytes=65537;expect(()=>validateExecutionCapabilities(source)).toThrow(/source limit/i);const wall=safe();wall.limits.max_wall_ms=20000;expect(()=>validateExecutionCapabilities(wall)).toThrow(/wall-time/i);const output=safe();output.limits.max_output_bytes=131072;expect(()=>validateExecutionCapabilities(output)).toThrow(/output policy/i)})
  it('fetches capabilities from one fixed same-origin path',async()=>{const fetchImpl=vi.fn(async(url,init)=>{expect(url).toBe('/v1/capabilities');expect(init.credentials).toBe('same-origin');return new Response(JSON.stringify(safe()),{status:200})});expect((await fetchExecutionCapabilities(fetchImpl)).schema_version).toBe('0.1');expect(fetchImpl).toHaveBeenCalledOnce();expect(CAPABILITIES_ENDPOINT).toBe('/v1/capabilities')})
})
