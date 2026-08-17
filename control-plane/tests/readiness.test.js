import { describe, expect, it, vi } from 'vitest'
import { controlPlaneReadiness } from '../src/readiness.js'
import { createApplication } from '../src/app.js'
import { createMockProvider } from '../src/providers/mock.js'

const baseEnv=()=>({VIEWER_ORIGIN:'https://viewer.example',CONTROL_API_TOKEN:'0123456789abcdef0123456789abcdef',ALLOW_UNLIMITED_DEV:'true',ALLOW_UNSIGNED_RESULTS_DEV:'true'})

describe('control plane readiness',()=>{
  it('reports explicit development bypasses internally without executing a job',()=>{let executions=0;const report=controlPlaneReadiness(()=>({async executePython(){executions++;return{provider:'mock',stdout:'',stderr:'',exitCode:0,timedOut:false}}}),baseEnv());expect(report.ready).toBe(true);expect(report.checks.rate_limit).toBe('explicit-dev-bypass');expect(report.checks.result_integrity).toBe('explicit-dev-unsigned');expect(executions).toBe(0)})
  it('fails closed internally when origin, authorization, signing, limiter, or provider configuration is missing',()=>{const report=controlPlaneReadiness(()=>{throw new Error('provider missing')},{VIEWER_ORIGIN:'http://viewer.example'});expect(report.ready).toBe(false);expect(report.checks.viewer_origin).toBe('missing-or-insecure');expect(report.checks.authorization).toBe('missing');expect(report.checks.rate_limit).toBe('missing');expect(report.checks.result_integrity).toBe('invalid');expect(report.checks.provider).toBe('invalid')})
  it('permits insecure localhost origin only behind the explicit dev switch',()=>{const no=controlPlaneReadiness(()=>createMockProvider(),{...baseEnv(),VIEWER_ORIGIN:'http://localhost:5173'});expect(no.ready).toBe(false);const yes=controlPlaneReadiness(()=>createMockProvider(),{...baseEnv(),VIEWER_ORIGIN:'http://localhost:5173',ALLOW_INSECURE_ORIGIN_DEV:'true'});expect(yes.ready).toBe(true)})
  it('does not consume the rate-limit binding when /ready is checked',async()=>{const limit=vi.fn(async()=>({success:true}));const env={...baseEnv(),ALLOW_UNLIMITED_DEV:'false',EXECUTION_RATE_LIMITER:{limit}};const app=createApplication(()=>createMockProvider());const response=await app(new Request('https://control.example/ready'),env);expect(response.status).toBe(200);expect(limit).not.toHaveBeenCalled();const body=await response.json();expect(body).toEqual({ready:true,service:'live-logic-control-plane'});expect(body).not.toHaveProperty('checks')})
  it('returns only minimal public state when readiness checks fail',async()=>{const app=createApplication(()=>{throw new Error('provider binding missing')});const response=await app(new Request('https://control.example/ready'),{});expect(response.status).toBe(503);const body=await response.json();expect(body).toEqual({ready:false,service:'live-logic-control-plane'});expect(body).not.toHaveProperty('checks')})
})
