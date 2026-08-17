function row(label,value) {
  const line=document.createElement('div');line.className='execution-inspector-row'
  const key=document.createElement('span');key.className='execution-inspector-key';key.textContent=label
  const val=document.createElement('span');val.className='execution-inspector-value';val.textContent=String(value ?? '—')
  line.append(key,val);return line
}
function outputBlock(label,text) {
  const wrap=document.createElement('section');wrap.className='execution-output'
  const heading=document.createElement('h4');heading.textContent=label
  const pre=document.createElement('pre');pre.textContent=String(text ?? '')
  wrap.append(heading,pre);return wrap
}
function integrityLabel(envelope,status){
  if(status==='verified')return`verified${envelope.integrity?.key_id?` · ${envelope.integrity.key_id}`:''}`
  if(status==='unsigned-dev')return'unsigned · explicit development mode'
  if(status==='present-unverified')return`signature present · not verified here${envelope.integrity?.key_id?` · ${envelope.integrity.key_id}`:''}`
  return envelope.integrity?'signature present · unverified':'unsigned / no trust context'
}
export function renderExecutionResult(root,envelope,{integrityStatus='unverified'}={}) {
  root.replaceChildren()
  const card=document.createElement('article');card.className=`execution-inspector execution-inspector-${envelope.status}`
  const heading=document.createElement('h3');heading.textContent='Execution Result'
  const note=document.createElement('p');note.className='execution-inspector-note';note.textContent='Execution output is displayed as data only. It is not Dynamic Logic evidence and does not modify any judgment.'
  const meta=document.createElement('div');meta.className='execution-inspector-meta'
  meta.append(row('Job',envelope.job_id),row('Status',envelope.status),row('Provider',envelope.execution.provider),row('Runner',envelope.execution.runner),row('Exit code',envelope.execution.exit_code),row('Timed out',envelope.execution.timed_out),row('Wall time',`${envelope.execution.wall_ms} ms`),row('Output truncated',envelope.result.truncated),row('Result integrity',integrityLabel(envelope,integrityStatus)))
  const provenance=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Provenance and integrity';provenance.append(summary,row('Request SHA-256',envelope.provenance.request_sha256),row('Source SHA-256',envelope.provenance.source_sha256));if(envelope.integrity){provenance.append(row('Algorithm',envelope.integrity.algorithm),row('Key id',envelope.integrity.key_id),row('Signature',envelope.integrity.signature))}
  card.append(heading,note,meta,outputBlock('stdout',envelope.result.stdout),outputBlock('stderr',envelope.result.stderr),provenance);root.append(card)
}
export function clearExecutionResult(root) { root.replaceChildren();const empty=document.createElement('p');empty.className='execution-inspector-empty';empty.textContent='No execution result loaded.';root.append(empty) }
