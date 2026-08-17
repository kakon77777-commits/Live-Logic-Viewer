import { describe, expect, it } from 'vitest'
import { createApplication, MIN_CONTROL_API_TOKEN_CHARACTERS } from '../src/app.js'
import { controlPlaneReadiness } from '../src/readiness.js'
import { createMockProvider } from '../src/providers/mock.js'

const requestBody=JSON.stringify({schema_version:'0.1',request_id:'req-auth-minimum-0123',runner:'python',source:'print(1)',network_policy:{mode:'deny'},limits:{wall_ms:5000,output_bytes:65536}})
function request(token){return new Request('https://control.example/v1/jobs',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',origin:'https://viewer.example'},body:requestBody})}
function env(token){return{CONTROL_API_TOKEN:token,VIEWER_ORIGIN:'https://viewer.example',ALLOW_UNLIMITED_DEV:'true',ALLOW_UNSIGNED_RESULTS_DEV:'true'}}

describe('control-plane authorization minimum',()=>{
  it('requires a 32-character configured token',async()=>{
    expect(MIN_CONTROL_API_TOKEN_CHARACTERS).toBe(32)
    const app=createApplication(()=>createMockProvider())
    const short='0123456789abcdef'
    expect((await app(request(short),env(short))).status).toBe(503)
    expect(controlPlaneReadiness(()=>createMockProvider(),env(short)).ready).toBe(false)
  })

  it('accepts a configured 32-character token through the auth gate',async()=>{
    const token='0123456789abcdef0123456789abcdef'
    const app=createApplication(()=>createMockProvider({stdout:'1\n'}))
    const response=await app(request(token),env(token))
    expect(response.status).toBe(200)
    expect(controlPlaneReadiness(()=>createMockProvider(),env(token)).ready).toBe(true)
  })
})
