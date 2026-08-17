import { describe, expect, it } from 'vitest'
import {
  RESULT_INTEGRITY_ALGORITHM,
  canonicalExecutionResultForIntegrity,
  signExecutionResult,
  verifyExecutionResultIntegrity
} from '../shared/execution-result-integrity.js'

function base64Url(buffer){let binary='';for(const value of new Uint8Array(buffer))binary+=String.fromCharCode(value);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
async function keys(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey);const p=await crypto.subtle.exportKey('jwk',pair.publicKey);return{pair,privateJwk,publicJwk:{kty:p.kty,crv:p.crv,x:p.x,y:p.y}}}
function core(){return{schema_version:'0.1',job_id:'legacy-job',status:'completed',execution:{provider:'mock',runner:'python',exit_code:0,timed_out:false,wall_ms:2},result:{type:'text',stdout:'2\n',stderr:'',truncated:false},provenance:{request_sha256:'1'.repeat(64),source_sha256:'2'.repeat(64)}}}

describe('execution result integrity payload versions',()=>{
  it('verifies a legacy v1 signature with no payload_version field',async()=>{const k=await keys();const envelope=core();const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},k.pair.privateKey,new TextEncoder().encode(canonicalExecutionResultForIntegrity(envelope,'1')));envelope.integrity={algorithm:RESULT_INTEGRITY_ALGORITHM,key_id:'legacy-key',signature:base64Url(signature)};await expect(verifyExecutionResultIntegrity(envelope,k.publicJwk,'legacy-key')).resolves.toBe(envelope)})
  it('new signer emits v2 and refuses to sign missing audit fields',async()=>{const k=await keys();await expect(signExecutionResult(core(),k.privateJwk,'new-key')).rejects.toThrow(/requires request_id/i)})
  it('v2 signature covers request and control-plane timestamps',async()=>{const k=await keys();const envelope={...core(),request_id:'req-version-01234567',received_at:'2026-08-17T06:00:00.000Z',completed_at:'2026-08-17T06:00:00.002Z'};envelope.integrity=await signExecutionResult(envelope,k.privateJwk,'new-key');expect(envelope.integrity.payload_version).toBe('2');await expect(verifyExecutionResultIntegrity(envelope,k.publicJwk,'new-key')).resolves.toBe(envelope);envelope.received_at='2026-08-17T06:00:01.000Z';await expect(verifyExecutionResultIntegrity(envelope,k.publicJwk,'new-key')).rejects.toThrow(/verification failed/i)})
})
