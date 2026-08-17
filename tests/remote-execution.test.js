import { describe, expect, it, vi } from 'vitest'
import { EXECUTION_ENDPOINT, submitRemoteExecution } from '../src/execution/client.js'
const result=()=>({schema_version:'0.1',job_id:'j1',status:'completed',execution:{provider:'mock',runner:'python',exit_code:0,timed_out:false,wall_ms:2},result:{type:'text',stdout:'2\\n',stderr:'',truncated:false},provenance:{request_sha256:'1'.repeat(64),source_sha256:'2'.repeat(64)}})
describe('remote execution client',()=>{
  it('uses a fixed same-origin endpoint and explicit network deny',async()=>{const fetchImpl=vi.fn(async(url,init)=>{expect(url).toBe('/v1/jobs');const body=JSON.parse(init.body);expect(body.network_policy).toEqual({mode:'deny'});expect(body.runner).toBe('python');return new Response(JSON.stringify(result()),{status:200})});const value=await submitRemoteExecution({source:'print(1+1)',accessToken:'0123456789abcdef',fetchImpl});expect(value.status).toBe('completed');expect(fetchImpl).toHaveBeenCalledOnce()})
  it('never accepts a caller-supplied execution endpoint',()=>expect(EXECUTION_ENDPOINT).toBe('/v1/jobs'))
  it('requires a nontrivial access token',async()=>{await expect(submitRemoteExecution({source:'print(1)',accessToken:'short',fetchImpl:vi.fn()})).rejects.toThrow(/token/i)})
})
