import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MAX_TEX_LENGTH } from '../protocol/limits.js'

export function validateFormulaProjection(formula) {
  if (!formula || typeof formula !== 'object') throw new TypeError('Formula projection must be an object')
  if (typeof formula.tex !== 'string' || formula.tex.length > MAX_TEX_LENGTH) throw new TypeError(`Formula TeX must be a string up to ${MAX_TEX_LENGTH} characters`)
  if (formula.value !== null && !['number','string','boolean'].includes(typeof formula.value)) throw new TypeError('Formula value must be scalar or null')
  return formula
}

export function renderFormula(target, formula) {
  const safe = validateFormulaProjection(formula)
  target.replaceChildren()
  katex.render(safe.tex, target, { throwOnError: false, trust: false, strict: 'warn', output: 'htmlAndMathml' })
}
