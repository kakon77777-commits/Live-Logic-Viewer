import { renderFormula } from './formula.js'

function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=String(text);return node}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function timeLabel(value){if(!value)return'';const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():String(value)}

export function renderView(root,current,previous=null){
  root.replaceChildren()
  const ids=Object.keys(current.claims)
  if(!ids.length){root.append(el('p','empty-state','No claim exists at this replay position.'));return}
  for(const id of ids){
    const card=el('article','claim-card')
    const heading=el('div','claim-heading');heading.append(el('span','claim-id',id),el('h2','claim-statement',current.claims[id].statement));card.append(heading)
    const judgment=current.judgments[id],prevJudgment=previous?.judgments?.[id]
    const badge=el('div',`judgment judgment-${judgment.projection}`,`${judgment.projection.toUpperCase()} · ${judgment.state}`);if(prevJudgment&&!same(prevJudgment,judgment))badge.classList.add('llv-changed');card.append(badge,el('p','judgment-reason',judgment.reason))
    const metricGrid=el('div','metric-grid');for(const field of['support','counterpressure','completeness']){const value=current.metrics[id]?.[field];const metric=el('div','metric');metric.append(el('span','metric-label',field),el('strong','metric-value',value==null?'—':`${(value*100).toFixed(1)}%`));if(previous&&previous.metrics?.[id]?.[field]!==value)metric.classList.add('llv-changed');metricGrid.append(metric)}card.append(metricGrid)
    const evidenceWrap=el('section','evidence-list');evidenceWrap.append(el('h3',null,'Evidence'));for(const item of current.evidence[id]||[]){const row=el('div',`evidence evidence-${item.direction}${item.invalidated?' evidence-invalidated':''}`);row.append(el('strong',null,item.label),el('span','evidence-meta',`${item.direction} · ${item.source_type}${item.invalidated?' · invalidated':''}`));evidenceWrap.append(row)}card.append(evidenceWrap)
    const formulas=Object.values(current.formulas[id]||{});if(formulas.length){const formulaWrap=el('section','formula-list');formulaWrap.append(el('h3',null,'Formula projection'));for(const formula of formulas){const target=el('div','formula');renderFormula(target,formula);formulaWrap.append(target)}card.append(formulaWrap)}
    const exec=current.execution[id];card.append(el('p',`execution execution-${exec.status}`,`Execution status: ${exec.status}${exec.detail?` · ${exec.detail}`:''}`));root.append(card)
  }
  const timeline=el('ol','timeline')
  for(const item of current.timeline){const text=`${item.sequence}. ${item.type} — ${item.label}`;const row=el('li',null,text);if(item.occurred_at){const time=el('time','timeline-time',timeLabel(item.occurred_at));time.dateTime=item.occurred_at;row.append(document.createTextNode(' · '),time)}timeline.append(row)}
  const parts=[`Timeline · event schema v${current.schema_version}`]
  if(current.package_created_at)parts.push(`package ${timeLabel(current.package_created_at)}`)
  root.append(el('h2','timeline-title',parts.join(' · ')),timeline)
}
