import { describe, expect, it } from 'vitest'
import { canonicalizeExecutionResult } from '../src/canonicalize.js'
import { executionCapabilities } from '../src/capabilities.js'
import { signCanonicalExecutionEnvelope } from '../src/signing.js'
import { verifyExecutionResultIntegrity } from '../../shared/execution-result-integrity.js'

async function fixture() {
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey)
  const exported=await crypto.subtle.exportKey('jwk',pair.publicKey)
  const publicJwk={kty:exported.kty,crv:exported.crv,x:exported.x,y:exported.y}
  return {privateJwk,publicJwk,keyId:'test-result-key'}
}

const request={schema_version:'0.1',request_id:'req-signing-01234567',runner:'python',source:'print(2)',network_policy:{mode:'deny'},limits:{wall_ms:5000,output_bytes:65536}}

async function envelope(){return canonicalizeExecutionResult({jobId:'job-signing',request,raw:{provider:'mock',stdout:'2\n',stderr:'',exitCode:0,timedOut:false},wallMs:2})}

describe('result signing',()=>{
  it('advertises only public key material',async()=>{const f=await fixture();const caps=executionCapabilities({RESULT_SIGNING_KEY_ID:f.keyId,RESULT_SIGNING_PUBLIC_JWK:JSON.stringify(f.publicJwk),RESULT_SIGNING_PRIVATE_JWK:JSON.stringify(f.privateJwk)});expect(caps.result_integrity.required).toBe(true);expect(caps.result_integrity.public_jwk).not.toHaveProperty('d');expect(caps.result_integrity.key_id).toBe(f.keyId)})
  it('signs and verifies the exact canonical envelope',async()=>{const f=await fixture();const env={RESULT_SIGNING_KEY_ID:f.keyId,RESULT_SIGNING_PUBLIC_JWK:JSON.stringify(f.publicJwk),RESULT_SIGNING_PRIVATE_JWK:JSON.stringify(f.privateJwk)};const signed=await signCanonicalExecutionEnvelope(await envelope(),env);expect(signed.integrity.key_id).toBe(f.keyId);await expect(verifyExecutionResultIntegrity(signed,f.publicJwk,f.keyId)).resolves.toBe(signed)})
  it('rejects tampering after signing',async()=>{const f=await fixture();const env={RESULT_SIGNING_KEY_ID:f.keyId,RESULT_SIGNING_PUBLIC_JWK:JSON.stringify(f.publicJwk),RESULT_SIGNING_PRIVATE_JWK:JSON.stringify(f.privateJwk)};const signed=await signCanonicalExecutionEnvelope(await envelope(),env);const tampered={...signed,result:{...signed.result,stdout:'changed\n'}};await expect(verifyExecutionResultIntegrity(tampered,f.publicJwk,f.keyId)).rejects.toThrow(/verification failed/i)})
})
