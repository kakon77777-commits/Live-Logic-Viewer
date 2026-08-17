import { describe, expect, it } from 'vitest'
import { parseAndValidateExecutionResult, validateExecutionResultObject } from '../src/execution/validate-result.js'
const valid=()=>({schema_version:'0.1',job_id:'j1',status:'completed',execution:{provider:'mock',runner:'python',exit_code:0,timed_out:false,wall_ms:2},result:{type:'text',stdout:'2\\n',stderr:'',truncated:false},provenance:{request_sha256:'1'.repeat(64),source_sha256:'2'.repeat(64)}})
describe('execution-result inspector protocol',()=>{
  it('accepts canonical execution results',()=>expect(validateExecutionResultObject(valid()).status).toBe('completed'))
  it('allows hostile-looking stdout only as a string value',()=>{const value=valid();value.result.stdout='<img src=x onerror=alert(1)>';expect(validateExecutionResultObject(value).result.stdout).toContain('onerror')})
  it('rejects executable-capability fields recursively',()=>{const value=valid();value.result.command='id';expect(()=>validateExecutionResultObject(value)).toThrow(/Forbidden field|Invalid execution result/)})
  it('rejects unknown top-level fields',()=>expect(()=>validateExecutionResultObject({...valid(),judgment:'true'})).toThrow(/Invalid execution result/))
  it('rejects oversized input',()=>expect(()=>parseAndValidateExecutionResult(JSON.stringify({...valid(),padding:'x'.repeat(200000)}))).toThrow())
})
