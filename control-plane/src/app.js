import { parseExecutionRequest, ExecutionProtocolError } from './protocol.js'
import { canonicalizeExecutionResult } from './canonicalize.js'
import { assertExecutionProvider, validateProviderRawResult } from './provider.js'
import { enforceExecutionRateLimit } from './rate-limit.js'
import { executionCapabilities } from './capabilities.js'
import { signCanonicalExecutionEnvelope } from './signing.js'
import { controlPlaneReadiness } from './readiness.js'

const JSON_HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'})
function json(value,status=200,extraHeaders={}){return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extraHeaders}})}
function corsHeaders(request,env){const origin=request.headers.get('origin');const allowed=env?.VIEWER_ORIGIN;if(!origin)return{};if(!allowed||origin!==allowed)return null;return{'access-control-allow-origin':allowed,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type','vary':'Origin'}}
function authorized(request,env){const token=env?.CONTROL_API_TOKEN;if(typeof token!=='string'||token.length<16)return'misconfigured';return(request.headers.get('authorization')||'')===`Bearer ${token}`}

export function createApplication(providerFactory){
  if(typeof providerFactory!=='function')throw new TypeError('providerFactory must be a function')
  return async function handle(request,env={}){
    const url=new URL(request.url)
    const cors=corsHeaders(request,env)
    if(cors===null)return json({error:'origin_not_allowed'},403)
    if(request.method==='OPTIONS'){
      if(!request.headers.get('origin'))return json({error:'origin_required'},400)
      return new Response(null,{status:204,headers:cors})
    }
    if(request.method==='GET'&&url.pathname==='/health')return json({ok:true,service:'live-logic-control-plane'},200,cors)
    if(request.method==='GET'&&url.pathname==='/ready'){
      const report=controlPlaneReadiness(providerFactory,env)
      return json(report,report.ready?200:503,cors)
    }
    if(request.method==='GET'&&url.pathname==='/v1/capabilities'){
      try{return json(executionCapabilities(env),200,cors)}
      catch{return json({error:'result_signing_not_configured'},503,cors)}
    }
    if(!(request.method==='POST'&&url.pathname==='/v1/jobs'))return json({error:'not_found'},404,cors)
    const auth=authorized(request,env)
    if(auth==='misconfigured')return json({error:'server_misconfigured'},503,cors)
    if(auth!==true)return json({error:'unauthorized'},401,cors)
    const rate=await enforceExecutionRateLimit(request,env)
    if(rate.misconfigured)return json({error:'rate_limiter_not_configured'},503,cors)
    if(!rate.allowed)return json({error:'rate_limited'},429,cors)
    const contentType=request.headers.get('content-type')||''
    if(!contentType.toLowerCase().startsWith('application/json'))return json({error:'content_type_must_be_json'},415,cors)
    let parsed
    try{parsed=parseExecutionRequest(await request.text())}
    catch(error){if(error instanceof ExecutionProtocolError)return json({error:error.code,message:error.message},400,cors);return json({error:'invalid_request'},400,cors)}
    const jobId=crypto.randomUUID()
    const receivedAt=new Date().toISOString()
    const started=Date.now()
    try{
      executionCapabilities(env)
      const provider=assertExecutionProvider(providerFactory(env))
      const raw=validateProviderRawResult(await provider.executePython({jobId,request:parsed}))
      const completedAt=new Date().toISOString()
      const envelope=await canonicalizeExecutionResult({jobId,request:parsed,raw,wallMs:Date.now()-started,receivedAt,completedAt})
      const signed=await signCanonicalExecutionEnvelope(envelope,env)
      return json(signed,200,cors)
    }catch(error){
      if(String(error?.message||'').includes('RESULT_SIGNING_')||String(error?.message||'').includes('Signing '))return json({error:'result_signing_not_configured'},503,cors)
      return json({schema_version:'0.1',job_id:jobId,status:'failed',error:'provider_failure'},502,cors)
    }
  }
}
