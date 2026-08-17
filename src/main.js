import './styles.css'
import { MAX_PACKAGE_BYTES } from './protocol/limits.js'
import { parseAndValidatePackage } from './protocol/validate.js'
import { createEventStore } from './store/event-store.js'
import { projectAt } from './projection/projector.js'
import { createPlaybackController } from './playback/controller.js'
import { renderView } from './renderer/dom.js'
import { fingerprintReplay, serializeReplayFingerprint } from './integrity/fingerprint.js'
import { MAX_EXECUTION_RESULT_BYTES, parseAndValidateExecutionResult } from './execution/validate-result.js'
import { clearExecutionResult, renderExecutionResult } from './execution/render-result.js'
import { submitRemoteExecution } from './execution/client.js'
import { classifyImportedExecutionIntegrity } from './execution/offline-integrity.js'
import { fetchExecutionCapabilities, safeExecutionLimits } from './execution/capabilities.js'
import { appendExecutionLifecycle, serializeEventStore } from './execution/lifecycle.js'

const viewer=document.getElementById('viewer'),status=document.getElementById('status'),fileInput=document.getElementById('package-file'),resultFileInput=document.getElementById('execution-result-file'),resultRoot=document.getElementById('execution-result'),resultDemoButton=document.getElementById('load-demo-execution'),downloadExecutionResult=document.getElementById('download-execution-result'),downloadReplayFingerprint=document.getElementById('download-replay-fingerprint'),replayFingerprint=document.getElementById('replay-fingerprint'),cursorLabel=document.getElementById('cursor-label'),remoteForm=document.getElementById('remote-execution-form'),remoteSource=document.getElementById('remote-source'),remoteToken=document.getElementById('remote-token'),remoteRun=document.getElementById('remote-run'),remoteNote=document.getElementById('remote-execution-note'),executionClaim=document.getElementById('execution-claim'),recordExecution=document.getElementById('record-execution'),downloadSession=document.getElementById('download-session')
const buttons={prev:document.getElementById('prev'),play:document.getElementById('play'),next:document.getElementById('next'),live:document.getElementById('live')}
let store=null,controller=null,previous=null,executionCapabilities=null,lastExecutionEnvelope=null,lastExecutionIntegrityStatus='unverified',lastReplayFingerprint=null,fingerprintGeneration=0

function setStatus(message,error=false){status.textContent=message;status.classList.toggle('error',error)}
function shortHash(value){return typeof value==='string'?`${value.slice(0,12)}…`:'—'}
function updateReplayFingerprint(cursor){
  const generation=++fingerprintGeneration
  lastReplayFingerprint=null
  downloadReplayFingerprint.disabled=true
  replayFingerprint.textContent='Calculating deterministic replay fingerprint…'
  void fingerprintReplay(store,cursor).then(value=>{
    if(generation!==fingerprintGeneration)return
    lastReplayFingerprint=value
    downloadReplayFingerprint.disabled=false
    replayFingerprint.textContent=`History ${shortHash(value.event_prefix_sha256)} · State ${shortHash(value.projection_sha256)} · cursor ${value.event_cursor}`
  }).catch(error=>{
    if(generation!==fingerprintGeneration)return
    replayFingerprint.textContent=`Replay fingerprint unavailable: ${error.message}`
  })
}
function draw(cursor){if(!store)return;const current=projectAt(store,cursor);renderView(viewer,current,previous);previous=current;cursorLabel.textContent=`Event ${current.cursor} / ${store.length}${current.cursor===store.length?' · Live':' · Replay'}`;buttons.play.textContent=controller?.playing?'⏸ Pause':'▶ Play';updateReplayFingerprint(current.cursor)}
function refreshExecutionClaims(){executionClaim.replaceChildren();if(!store){executionClaim.disabled=true;recordExecution.disabled=true;return}const state=projectAt(store,store.length);const ids=Object.keys(state.claims);for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=`${id} — ${state.claims[id].statement}`;executionClaim.append(option)}executionClaim.disabled=ids.length===0;recordExecution.disabled=!lastExecutionEnvelope||ids.length===0}
function bindStore(nextStore,label){controller?.destroy();store=nextStore;previous=null;lastReplayFingerprint=null;downloadReplayFingerprint.disabled=true;controller=createPlaybackController({maxCursor:store.length,onCursor:draw,intervalMs:850});draw(store.length);downloadSession.disabled=false;refreshExecutionClaims();setStatus(`${label} · ${store.length} validated events`)}
function clearExecutionEnvelope(){lastExecutionEnvelope=null;lastExecutionIntegrityStatus='unverified';downloadExecutionResult.disabled=true;clearExecutionResult(resultRoot);refreshExecutionClaims()}
function loadPackage(pkg,label){clearExecutionEnvelope();bindStore(createEventStore(pkg),`${label} loaded`)}
function setExecutionEnvelope(envelope,message,integrityStatus='unverified'){lastExecutionEnvelope=envelope;lastExecutionIntegrityStatus=integrityStatus;downloadExecutionResult.disabled=false;renderExecutionResult(resultRoot,envelope,{integrityStatus});refreshExecutionClaims();setStatus(message)}
async function loadBuiltInDemo(){try{const response=await fetch('/examples/demo-events.json',{credentials:'same-origin'});if(!response.ok)throw new Error(`HTTP ${response.status}`);loadPackage(parseAndValidatePackage(await response.text()),'Built-in demo')}catch(error){setStatus(`Demo load failed: ${error.message}`,true)}}
async function loadExecutionDemo(){try{const response=await fetch('/examples/demo-execution-result.json',{credentials:'same-origin'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const envelope=parseAndValidateExecutionResult(await response.text());setExecutionEnvelope(envelope,'Safe execution-result demo loaded. Judgment state was not modified.',envelope.integrity?'present-unverified':'unverified')}catch(error){setStatus(`Execution demo load failed: ${error.message}`,true)}}
function applyCapabilities(caps){const safe=safeExecutionLimits(caps);executionCapabilities=caps;remoteRun.disabled=false;const integrity=caps.result_integrity.required?`signed results required · active key ${caps.result_integrity.key_id} · ${caps.result_integrity.verification_keys.length} trusted key(s)`:'unsigned results allowed only by explicit dev capability';remoteNote.textContent=`Control plane verified: Python only · outbound network denied · ${Math.floor(safe.max_source_bytes/1024)} KiB source · ${safe.wall_ms} ms · ${Math.floor(safe.output_bytes/1024)} KiB output · ${integrity}.`;return caps}
async function refreshCapabilities(){const caps=await fetchExecutionCapabilities();return applyCapabilities(caps)}
async function loadCapabilities(){executionCapabilities=null;remoteRun.disabled=true;remoteNote.textContent='Checking the control plane safety contract…';try{await refreshCapabilities()}catch(error){remoteNote.textContent=`Remote execution disabled: ${error.message}`;setStatus('Remote execution safety handshake failed. Static Viewer and replay remain available.',true)}}
function safeDownloadName(){const id=String(store?.packageId||'live-logic-session').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80);return `${id||'live-logic-session'}.json`}
function downloadBlob(text,name){const blob=new Blob([text],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
function downloadSessionPackage(){if(!store)return;downloadBlob(serializeEventStore(store),safeDownloadName())}
function downloadReplayFingerprintPackage(){if(!lastReplayFingerprint)return;const id=String(lastReplayFingerprint.package_id||'live-logic-replay').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80)||'live-logic-replay';downloadBlob(serializeReplayFingerprint(lastReplayFingerprint),`${id}.cursor-${lastReplayFingerprint.event_cursor}.fingerprint.json`)}
function downloadExecutionPackage(){if(!lastExecutionEnvelope)return;const id=String(lastExecutionEnvelope.job_id||'execution-result').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80)||'execution-result';downloadBlob(`${JSON.stringify(lastExecutionEnvelope,null,2)}\n`,`${id}.execution-result.json`)}

fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file)return;try{if(file.size>MAX_PACKAGE_BYTES)throw new Error(`File exceeds ${MAX_PACKAGE_BYTES} bytes`);loadPackage(parseAndValidatePackage(await file.text()),file.name)}catch(error){setStatus(`Import rejected: ${error.message}`,true)}finally{fileInput.value=''}})
resultFileInput.addEventListener('change',async()=>{const file=resultFileInput.files?.[0];if(!file)return;try{if(file.size>MAX_EXECUTION_RESULT_BYTES)throw new Error(`File exceeds ${MAX_EXECUTION_RESULT_BYTES} bytes`);const envelope=parseAndValidateExecutionResult(await file.text());const integrityStatus=await classifyImportedExecutionIntegrity({envelope,capabilities:executionCapabilities,refreshCapabilities});setExecutionEnvelope(envelope,`${file.name} inspected as execution data only. No evidence or judgment was changed.`,integrityStatus)}catch(error){setStatus(`Execution result rejected: ${error.message}`,true)}finally{resultFileInput.value=''}})
buttons.prev.addEventListener('click',()=>controller?.step(-1));buttons.next.addEventListener('click',()=>controller?.step(1));buttons.live.addEventListener('click',()=>controller?.live());buttons.play.addEventListener('click',()=>{if(!controller)return;controller.playing?controller.pause():controller.play();buttons.play.textContent=controller.playing?'⏸ Pause':'▶ Play'});resultDemoButton.addEventListener('click',loadExecutionDemo);downloadSession.addEventListener('click',downloadSessionPackage);downloadReplayFingerprint.addEventListener('click',downloadReplayFingerprintPackage);downloadExecutionResult.addEventListener('click',downloadExecutionPackage)
recordExecution.addEventListener('click',()=>{if(!store||!lastExecutionEnvelope||!executionClaim.value)return;try{const appended=appendExecutionLifecycle({store,envelope:lastExecutionEnvelope,claimId:executionClaim.value,integrityStatus:lastExecutionIntegrityStatus});const event=appended.event;clearExecutionEnvelope();bindStore(appended.store,`${event.type} recorded explicitly`);recordExecution.disabled=true}catch(error){setStatus(`Lifecycle record rejected: ${error.message}`,true)}})
remoteForm.addEventListener('submit',async event=>{event.preventDefault();if(remoteRun.disabled||!executionCapabilities)return;remoteRun.disabled=true;setStatus('Submitting isolated execution job…');const token=remoteToken.value;remoteToken.value='';try{const envelope=await submitRemoteExecution({source:remoteSource.value,accessToken:token,capabilities:executionCapabilities,refreshCapabilities});const integrityStatus=envelope.integrity?'verified':'unsigned-dev';setExecutionEnvelope(envelope,`Managed execution ${envelope.status}. Result was not promoted to evidence.`,integrityStatus)}catch(error){setStatus(error.message,true)}finally{remoteRun.disabled=!executionCapabilities}})

clearExecutionEnvelope();loadBuiltInDemo();loadCapabilities()
