import { describe, expect, it, vi } from 'vitest'
import { classifyImportedExecutionIntegrity } from '../src/execution/offline-integrity.js'
import { canonicalExecutionRequest } from '../shared/execution-request.js'
import { sha256Hex } from '../shared/sha256.js'
import { signExecutionResult } from '../shared/execution-result-integrity.js'

async function keyFixture(keyId='key-1'){
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey)
  const p=await crypto.subtle.exportKey('jwk',pair.publicKey)
  return{keyId,privateJwk,publicJwk:{kty:p.kty,crv:p.crv,x:p.x,y:p.y}}
}

const request={schema_version:'0.1',request_id:'req-offline-01234567',runner:'python',source:'print(2)',network_policy:{mode:'deny'},limits:{wall_ms:5000,output_bytes:65536}}
async function envelope(){return{schema_version:'0.1',job_id:'offline-job',status:'completed',execution:{provider:'mock',runner:'python',exit_code:0,timed_out:false,wall_ms:2},result:{type:'text',stdout:'2\n',stderr:'',truncated:false},provenance:{source_sha256:await sha256Hex(request.source),request_sha256:await sha256Hex(canonicalExecutionRequest(request))}}}
function caps(keys=[],required=false){const active=keys[0]||null;return{schema_version:'0.1',runners:['python'],network_policies:['deny'],limits:{max_source_bytes:65536,min_wall_ms:100,max_wall_ms:10000,min_output_bytes:1024,max_output_bytes:65536},execution_result_is_evidence:false,result_integrity:{required,algorithm:'ECDSA_P256_SHA256',key_id:active?.keyId??null,public_jwk:active?.publicJwk??null,verification_keys:keys.map(k=>({key_id:k.keyId,public_jwk:k.publicJwk}))}}}

describe('offline execution-result integrity classification',()=>{
  it('keeps unsigned archives inspectable as unverified',async()=>{expect(await classifyImportedExecutionIntegrity({envelope:await envelope(),capabilities:null})).toBe('unverified')})
  it('marks a signature unverified when no trust context exists',async()=>{const key=await keyFixture();const value=await envelope();value.integrity=await signExecutionResult(value,key.privateJwk,key.keyId);expect(await classifyImportedExecutionIntegrity({envelope:value,capabilities:null})).toBe('present-unverified')})
  it('verifies a signed archive against a trusted capability key',async()=>{const key=await keyFixture();const value=await envelope();value.integrity=await signExecutionResult(value,key.privateJwk,key.keyId);expect(await classifyImportedExecutionIntegrity({envelope:value,capabilities:caps([key],true)})).toBe('verified')})
  it('keeps an unknown-key archive inspectable when capability refresh is unavailable',async()=>{const trusted=await keyFixture('trusted');const other=await keyFixture('other');const value=await envelope();value.integrity=await signExecutionResult(value,other.privateJwk,other.keyId);const refresh=vi.fn(async()=>{throw new Error('offline')});expect(await classifyImportedExecutionIntegrity({envelope:value,capabilities:caps([trusted],true),refreshCapabilities:refresh})).toBe('present-unverified');expect(refresh).toHaveBeenCalledOnce()})
  it('verifies an archive after a key-rotation capability refresh',async()=>{const old=await keyFixture('old');const fresh=await keyFixture('fresh');const value=await envelope();value.integrity=await signExecutionResult(value,fresh.privateJwk,fresh.keyId);const refresh=vi.fn(async()=>caps([fresh,old],true));expect(await classifyImportedExecutionIntegrity({envelope:value,capabilities:caps([old],true),refreshCapabilities:refresh})).toBe('verified')})
  it('rejects tampering when the signing key is trusted',async()=>{const key=await keyFixture();const value=await envelope();value.integrity=await signExecutionResult(value,key.privateJwk,key.keyId);value.result.stdout='tampered\n';await expect(classifyImportedExecutionIntegrity({envelope:value,capabilities:caps([key],true)})).rejects.toThrow(/signature verification failed/i)})
})
