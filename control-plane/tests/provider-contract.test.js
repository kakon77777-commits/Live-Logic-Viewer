import { describe, expect, it } from 'vitest'
import { assertExecutionProvider, validateProviderRawResult } from '../src/provider.js'
import { createMockProvider } from '../src/providers/mock.js'

const job={jobId:'job-conformance',request:{schema_version:'0.1',request_id:'req-provider-01234567',runner:'python',source:'print(1)',network_policy:{mode:'deny'},limits:{wall_ms:5000,output_bytes:65536}}}

describe('execution provider contract',()=>{
  it('accepts the mock provider and canonical raw result shape',async()=>{const provider=assertExecutionProvider(createMockProvider({stdout:'1\n'}));const raw=validateProviderRawResult(await provider.executePython(job));expect(raw).toEqual({provider:'mock',stdout:'1\n',stderr:'',exitCode:0,timedOut:false,outputLimited:false})})
  it('rejects provider results with unknown fields',()=>{expect(()=>validateProviderRawResult({provider:'mock',stdout:'',stderr:'',exitCode:0,timedOut:false,credential:'secret'})).toThrow(/unknown field/i)})
  it('rejects structured stdout and stderr',()=>{expect(()=>validateProviderRawResult({provider:'mock',stdout:{text:'x'},stderr:'',exitCode:0,timedOut:false})).toThrow(/stdout/i);expect(()=>validateProviderRawResult({provider:'mock',stdout:'',stderr:[],exitCode:0,timedOut:false})).toThrow(/stderr/i)})
  it('requires explicit timeout state',()=>{expect(()=>validateProviderRawResult({provider:'mock',stdout:'',stderr:'',exitCode:0})).toThrow(/timedOut/i)})
  it('rejects adapters without executePython',()=>{expect(()=>assertExecutionProvider({})).toThrow(/executePython/i)})
})
