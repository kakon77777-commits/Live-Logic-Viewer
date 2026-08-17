import { describe, expect, it } from 'vitest'
import { fetchExecutionCapabilities, validateExecutionCapabilities } from '../src/execution/capabilities.js'

const safe=()=>({schema_version:'0.1',runners:['python'],network_policies:['deny'],limits:{max_source_bytes:65536,min_wall_ms:100,max_wall_ms:10000,min_output_bytes:1024,max_output_bytes:65536},execution_result_is_evidence:false,result_integrity:{required:false,algorithm:'ECDSA_P256_SHA256',key_id:null,public_jwk:null,verification_keys:[]}})
const bytes=text=>new TextEncoder().encode(text)

describe('capability response security',()=>{
  it('rejects malformed P-256 coordinate lengths before WebCrypto',()=>{
    const value=safe();value.result_integrity={required:true,algorithm:'ECDSA_P256_SHA256',key_id:'active',public_jwk:{kty:'EC',crv:'P-256',x:'short',y:'also-short'},verification_keys:[{key_id:'active',public_jwk:{kty:'EC',crv:'P-256',x:'short',y:'also-short'}}]}
    expect(()=>validateExecutionCapabilities(value)).toThrow(/32-byte base64url coordinates/i)
  })

  it('rejects an oversized declared capability response before buffering',async()=>{
    const fetchImpl=async()=>new Response('{}',{status:200,headers:{'content-length':String(20000)}})
    await expect(fetchExecutionCapabilities(fetchImpl)).rejects.toThrow(/response rejected:.*exceeds/i)
  })

  it('rejects a streamed capability response that crosses the byte budget',async()=>{
    const body=new ReadableStream({start(controller){controller.enqueue(bytes('x'.repeat(10000)));controller.enqueue(bytes('y'.repeat(10000)));controller.close()}})
    await expect(fetchExecutionCapabilities(async()=>new Response(body,{status:200}))).rejects.toThrow(/response rejected:.*exceeds/i)
  })

  it('rejects invalid UTF-8 capability response bytes',async()=>{
    const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([0xc3,0x28]));controller.close()}})
    await expect(fetchExecutionCapabilities(async()=>new Response(body,{status:200}))).rejects.toThrow(/response rejected:.*not valid UTF-8/i)
  })
})
