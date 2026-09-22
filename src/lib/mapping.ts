import { CHECKLIST_FIELDS, RECORD_STATUS_ALIASES } from '../config/checklist'
import type { Dataset, FieldMapping } from '../types'
import { normalizeHeader } from './normalizers'

const GENERIC_TOKENS = new Set([
  'TAB','TB','CAD','CADASTRO','DADOS','CLIENTE','CLI','PESSOA','PESSOAS',
  'DES','DESC','DESCRICAO','NUM','NUMERO','COD','CODIGO','VALOR','VLR',
  'FLG','IND','FLAG','CAMPO','INFO','INFORMACAO',
])

const CONVENIO_FIELD_IDS = new Set([
  'empresaConvenio',
  'conveniado',
  'statusConvenio',
  'limiteConvenio',
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

const remainderIsGeneric = (full: string, part: string) => {
  const fullTokens = normalizeHeader(full).split('_').filter(Boolean)
  const partTokens = normalizeHeader(part).split('_').filter(Boolean)
  if (!fullTokens.length || !partTokens.length || fullTokens.length <= partTokens.length) return false

  if (fullTokens.slice(0, partTokens.length).join('_') === partTokens.join('_')) {
    return fullTokens.slice(partTokens.length).every(token => GENERIC_TOKENS.has(token))
  }

  if (fullTokens.slice(-partTokens.length).join('_') === partTokens.join('_')) {
    return fullTokens.slice(0, fullTokens.length - partTokens.length).every(token => GENERIC_TOKENS.has(token))
  }

  return false
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

    if (remainderIsGeneric(h, alias) || remainderIsGeneric(alias, h)) {
      best = Math.max(best, 90)
      continue
    }

    const similarity = tokenSimilarity(header, rawAlias)
    if (similarity >= 0.75) best = Math.max(best, 88)
  }

  return best
}

const pickBestHeader = (headers: string[], aliases: string[]) => {
  let best = ''
  let score = 0
  let ambiguous = false

  for (const header of headers) {
    if (header.startsWith('__primecheck_')) continue
    const current = scoreHeader(header, aliases)

    if (current > score) {
      score = current
      best = header
      ambiguous = false
      continue
    }

    // Se duas colunas alcançam exatamente a mesma melhor pontuação,
    // não é seguro escolher apenas pela ordem em que aparecem no arquivo.
    if (current > 0 && current === score && header !== best) {
      ambiguous = true
    }
  }

  return score >= 60 && !ambiguous ? { header: best, score } : { header: '', score: 0 }
}

const duplicateBase = (header: string) =>
  normalizeHeader(header.replace(/__\d+$/, ''))

const hasAmbiguousDuplicate = (headers: string[], selected: string) => {
  if (!selected) return false
  const base = duplicateBase(selected)
  return headers.filter(header => duplicateBase(header) === base).length > 1
}

const isBareTokenHeader = (header: string, token: string) => {
  const tokens = duplicateBase(header).split('_').filter(Boolean)
  return tokens.length === 1 && tokens[0] === token
}

const assignHeaders = (headers: string[]) => {
  const claimed = new Map<string, Array<{ fieldId: string; score: number }>>()

  CHECKLIST_FIELDS.forEach(field => {
    const picked = pickBestHeader(headers, [field.label, ...field.aliases])
    if (!picked.header) return

    if (CONVENIO_FIELD_IDS.has(field.id) && isBareTokenHeader(picked.header, 'CONVENIO')) return
    if (field.id === 'pessoaTipo' && isBareTokenHeader(picked.header, 'EMPRESA')) return
    if (CONVENIO_FIELD_IDS.has(field.id) && hasAmbiguousDuplicate(headers, picked.header)) return

    const list = claimed.get(picked.header) ?? []
    list.push({ fieldId: field.id, score: picked.score })
    claimed.set(picked.header, list)
  })

  const assigned = new Map<string, string>()

  claimed.forEach((candidates, header) => {
    const ranked = [...candidates].sort((a, b) => b.score - a.score)
    if (ranked.length === 1) {
      assigned.set(ranked[0].fieldId, header)
      return
    }

    // Só vincula automaticamente quando um campo vence o outro com folga.
    // Empate ou disputa próxima permanece para confirmação manual.
    if (ranked[0].score >= ranked[1].score + 10) {
      assigned.set(ranked[0].fieldId, header)
    }
  })

  return assigned
}

export const autoMap = (origin: Dataset, target: Dataset): FieldMapping[] => {
  const originAssigned = assignHeaders(origin.headers)
  const targetAssigned = assignHeaders(target.headers)

  return CHECKLIST_FIELDS.map(field => ({
    fieldId: field.id,
    originHeader: originAssigned.get(field.id) ?? '',
    targetHeader: targetAssigned.get(field.id) ?? '',
  }))
}

export const detectStatusHeader = (dataset: Dataset) =>
  pickBestHeader(dataset.headers, RECORD_STATUS_ALIASES).header

export const mappingCoverage = (mapping: FieldMapping[]) => {
  const both = mapping.filter(m => m.originHeader && m.targetHeader).length
  const originOnly = mapping.filter(m => m.originHeader && !m.targetHeader).length
  const targetOnly = mapping.filter(m => !m.originHeader && m.targetHeader).length
  const none = mapping.filter(m => !m.originHeader && !m.targetHeader).length

  return { both, originOnly, targetOnly, none, total: mapping.length }
}
