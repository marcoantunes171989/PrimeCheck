import { CHECKLIST_FIELDS, RECORD_STATUS_ALIASES } from '../config/checklist'
import type { Dataset, FieldMapping } from '../types'
import { normalizeHeader } from './normalizers'

const GENERIC_TOKENS = new Set([
  'TAB','TB','CAD','CADASTRO','DADOS','CLIENTE','CLI','PESSOA','PESSOAS',
  'DES','DESC','DESCRICAO','NUM','NUMERO','COD','CODIGO','VALOR','VLR',
  'FLG','IND','FLAG','CAMPO','INFO','INFORMACAO',
])

const compact = (value: string) =>
  normalizeHeader(value)
    .split('_')
    .filter(Boolean)
    .filter(token => !GENERIC_TOKENS.has(token))
    .join('_')

const tokenSet = (value: string) =>
  new Set(
    normalizeHeader(value)
      .split('_')
      .filter(Boolean)
      .filter(token => !GENERIC_TOKENS.has(token)),
  )

const tokenSimilarity = (a: string, b: string) => {
  const left = tokenSet(a)
  const right = tokenSet(b)
  if (!left.size || !right.size) return 0

  let intersection = 0
  left.forEach(token => {
    if (right.has(token)) intersection += 1
  })

  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

const scoreHeader = (header: string, aliases: string[]) => {
  const h = normalizeHeader(header)
  const hc = compact(header)
  let best = 0

  for (const rawAlias of aliases) {
    const alias = normalizeHeader(rawAlias)
    const ac = compact(rawAlias)

    if (h === alias) {
      best = Math.max(best, 100)
      continue
    }

    if (hc && ac && hc === ac) {
      best = Math.max(best, 96)
      continue
    }

    if (
      h.endsWith(`_${alias}`) ||
      h.startsWith(`${alias}_`) ||
      alias.endsWith(`_${h}`) ||
      alias.startsWith(`${h}_`)
    ) {
      best = Math.max(best, 90)
      continue
    }

    if (h.includes(alias) || alias.includes(h)) {
      best = Math.max(best, Math.min(86, 66 + Math.min(h.length, alias.length) / 2))
    }

    if (hc && ac && (hc.includes(ac) || ac.includes(hc))) {
      best = Math.max(best, 84)
    }

    const similarity = tokenSimilarity(header, rawAlias)
    if (similarity >= 0.75) best = Math.max(best, 88)
    else if (similarity >= 0.5) best = Math.max(best, 78)
  }

  return best
}

const bestHeader = (headers: string[], aliases: string[]) => {
  let best = ''
  let score = 0

  for (const header of headers) {
    if (header.startsWith('__primecheck_')) continue
    const current = scoreHeader(header, aliases)

    if (current > score) {
      score = current
      best = header
    }
  }

  return score >= 60 ? best : ''
}

const duplicateBase = (header: string) =>
  normalizeHeader(header.replace(/__\d+$/, ''))

const hasAmbiguousDuplicate = (headers: string[], selected: string) => {
  if (!selected) return false
  const base = duplicateBase(selected)
  return headers.filter(header => duplicateBase(header) === base).length > 1
}

export const autoMap = (origin: Dataset, target: Dataset): FieldMapping[] =>
  CHECKLIST_FIELDS.map(field => {
    const originHeader = bestHeader(origin.headers, [field.label, ...field.aliases])
    let targetHeader = bestHeader(target.headers, [field.label, ...field.aliases])

    // No perfil local havia várias colunas "Convênio" com finalidades diferentes.
    // Nestes campos, é mais seguro exigir confirmação humana do que vincular a coluna errada.
    if (
      (field.id === 'empresaConvenio' || field.id === 'conveniado') &&
      hasAmbiguousDuplicate(target.headers, targetHeader)
    ) {
      targetHeader = ''
    }

    return { fieldId: field.id, originHeader, targetHeader }
  })

export const detectStatusHeader = (dataset: Dataset) =>
  bestHeader(dataset.headers, RECORD_STATUS_ALIASES)

export const mappingCoverage = (mapping: FieldMapping[]) => {
  const both = mapping.filter(m => m.originHeader && m.targetHeader).length
  const originOnly = mapping.filter(m => m.originHeader && !m.targetHeader).length
  const targetOnly = mapping.filter(m => !m.originHeader && m.targetHeader).length
  const none = mapping.filter(m => !m.originHeader && !m.targetHeader).length

  return { both, originOnly, targetOnly, none, total: mapping.length }
}
