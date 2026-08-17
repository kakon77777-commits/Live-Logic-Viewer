import { describe, expect, it } from 'vitest'
import { canonicalizeExecutionResult } from '../src/canonicalize.js'
import { executionCapabilities } from '../src/capabilities.js'
import { resultSigningConfig, signCanonicalExecutionEnvelope } from '../src/signing.js'
import { verifyExecutionResultIntegrity } from '../../shared/execution-result-integrity.js'

async function fixture(keyId='test-result-key') {
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey)
  const exported=await crypto.subtle.exportKey('jwk',pair.publicKey)
  const publicJwk={kty:exported.kty,crv:exported.crv,x:exported.x,y:exported.y}
  return {privateJwk,publicJwk,keyId}
}

const request={schema_version:'0.1',request_id:'req-signing-01234567',runner:'python',source:'print(2)',network_policy:{mode:'deny'},limits:{wall_ms:5000,output_bytes:65536}}
async function envelope(){return canonicalizeExecutionResult({jobId:'job-signing',request,raw:{provider:'mock',stdout:'2\n',stderr:'',exitCode:0,timedOut:false},wallMs:2})}
function envFor(f,extra={}){return{RESULT_SIGNING_KEY_ID:f.keyId,RESULT_SIGNING_PUBLIC_JWK:JSON.stringify(f.publicJwk),RESULT_SIGNING_PRIVATE_JWK:JSON.stringify(f.privateJwk),...extra}}

describe('result signing',()=>{
  it('advertises only public key material',async()=>{const f=await fixture();const caps=executionCapabilities(envFor(f));expect(caps.result_integrity.required).toBe(true);expect(caps.result_integrity.public_jwk).not.toHaveProperty('d');expect(caps.result_integrity.key_id).toBe(f.keyId);expect(caps.result_integrity.verification_keys).toHaveLength(1);expect(caps.result_integrity.verification_keys[0].public_jwk).not.toHaveProperty('d')})
  it('advertises active plus previous public verification keys',async()=>{const active=await fixture('active-key');const previous=await fixture('previous-key');const caps=executionCapabilities(envFor(active,{RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS:JSON.stringify([{key_id:previous.keyId,public_jwk:previous.publicJwk}])}));expect(caps.result_integrity.key_id).toBe('active-key');expect(caps.result_integrity.verification_keys.map(x=>x.key_id)).toEqual(['active-key','previous-key']);for(const entry of caps.result_integrity.verification_keys)expect(entry.public_jwk).not.toHaveProperty('d')})
  it('rejects duplicate active/previous key ids',async()=>{const active=await fixture('same-key');expect(()=>resultSigningConfig(envFor(active,{RESULT_SIGNING_PREVIOUS_PUBLIC_JWKS:JSON.stringify([{key_id:'same-key',public_jwk:active.publicJwk}])}))).toThrow(/duplicate/i)})
  it('signs and verifies the exact canonical envelope',async()=>{const f=await fixture();const signed=await signCanonicalExecutionEnvelope(await envelope(),envFor(f));expect(signed.integrity.key_id).toBe(f.keyId);await expect(verifyExecutionResultIntegrity(signed,f.publicJwk,f.keyId)).resolves.toBe(signed)})
  it('rejects tampering after signing',async()=>{const f=await fixture();const signed=await signCanonicalExecutionEnvelope(await envelope(),envFor(f));const tampered={...signed,result:{...signed.result,stdout:'changed\n'}};await expect(verifyExecutionResultIntegrity(tampered,f.publicJwk,f.keyId)).rejects.toThrow(/verification failed/i)})
})
