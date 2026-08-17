import { describe, expect, it } from 'vitest'
import { submitRemoteExecution } from '../src/execution/client.js'

const capabilities=()=>({schema_version:'0.1',runners:['python'],network_policies:['deny'],limits:{max_source_bytes:65536,min_wall_ms:100,max_wall_ms:10000,min_output_bytes:1024,max_output_bytes:65536},execution_result_is_evidence:false,result_integrity:{required:false,algorithm:'ECDSA_P256_SHA256',key_id:null,public_jwk:null,verification_keys:[]}})
const args=fetchImpl=>({source:'print(1)',accessToken:'0123456789abcdef',capabilities:capabilities(),requestIdFactory:()=> 'req-body-limit-012345',fetchImpl})
const bytes=text=>new TextEncoder().encode(text)

describe('remote response streaming limits',()=>{
  it('rejects an oversized declared response before consuming its body',async()=>{
    const fetchImpl=async()=>new Response('{}',{status:200,headers:{'content-length':String(300000)}})
    await expect(submitRemoteExecution(args(fetchImpl))).rejects.toThrow(/response rejected:.*exceeds/i)
  })

  it('rejects a chunked response once its streamed byte budget is crossed',async()=>{
    const body=new ReadableStream({start(controller){controller.enqueue(bytes('x'.repeat(100000)));controller.enqueue(bytes('y'.repeat(100000)));controller.close()}})
    const fetchImpl=async()=>new Response(body,{status:200})
    await expect(submitRemoteExecution(args(fetchImpl))).rejects.toThrow(/response rejected:.*exceeds/i)
  })

  it('rejects invalid UTF-8 result bytes before JSON parsing',async()=>{
    const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([0xc3,0x28]));controller.close()}})
    const fetchImpl=async()=>new Response(body,{status:200})
    await expect(submitRemoteExecution(args(fetchImpl))).rejects.toThrow(/response rejected:.*not valid UTF-8/i)
  })
})
