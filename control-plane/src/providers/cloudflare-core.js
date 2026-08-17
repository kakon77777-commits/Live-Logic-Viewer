import { assertExecutionProvider } from '../provider.js'

function sandboxId(jobId) {
  const compact = String(jobId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  return `job-${compact || 'anonymous'}`
}
function byteLength(text){return new TextEncoder().encode(String(text)).byteLength}
function takeUtf8Prefix(text,maxBytes){const source=String(text??'');if(maxBytes<=0)return{text:'',truncated:source.length>0};if(byteLength(source)<=maxBytes)return{text:source,truncated:false};const points=[...source];let lo=0,hi=points.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(byteLength(points.slice(0,mid).join(''))<=maxBytes)lo=mid;else hi=mid-1}return{text:points.slice(0,lo).join(''),truncated:true}}

export function createCloudflareProviderCore(env,{getSandboxImpl}) {
  if(!env?.Sandbox)throw new Error('Cloudflare Sandbox binding is not configured')
  if(typeof getSandboxImpl!=='function')throw new TypeError('getSandboxImpl must be a function')
  return assertExecutionProvider({async executePython({jobId,request}){
    const sandbox=getSandboxImpl(env.Sandbox,sandboxId(jobId));const cap=request.limits.output_bytes
    let stdout='',stderr='',usedBytes=0,outputLimited=false,timedOut=false,destroyPromise=null
    const destroyOnce=()=>{if(!destroyPromise)destroyPromise=Promise.resolve().then(()=>sandbox.destroy()).catch(()=>{});return destroyPromise}
    const appendOutput=(stream,data)=>{if(outputLimited)return;const remaining=Math.max(0,cap-usedBytes);const piece=takeUtf8Prefix(data,remaining);if(stream==='stderr')stderr+=piece.text;else stdout+=piece.text;usedBytes+=byteLength(piece.text);if(piece.truncated){outputLimited=true;void destroyOnce()}}
    const deadline=setTimeout(()=>{timedOut=true;void destroyOnce()},request.limits.wall_ms)
    try {
      await sandbox.writeFile('/workspace/main.py',request.source)
      const result=await sandbox.exec('python3 /workspace/main.py',{cwd:'/workspace',timeout:request.limits.wall_ms+250,stream:true,onOutput:appendOutput})
      return{provider:'cloudflare',stdout,stderr,exitCode:Number.isInteger(result?.exitCode)?result.exitCode:null,timedOut,outputLimited}
    } catch(error) {
      if(timedOut||outputLimited)return{provider:'cloudflare',stdout,stderr,exitCode:null,timedOut,outputLimited}
      throw error
    } finally { clearTimeout(deadline);await destroyOnce() }
  }})
}
