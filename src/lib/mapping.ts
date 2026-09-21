import { CHECKLIST_FIELDS, RECORD_STATUS_ALIASES } from '../config/checklist'
import type { Dataset, FieldMapping } from '../types'
import { normalizeHeader } from './normalizers'

const scoreHeader = (header: string, aliases: string[]) => {
  const h = normalizeHeader(header)
  let best = 0
  for (const alias of aliases.map(normalizeHeader)) {
    if (h === alias) best = Math.max(best, 100)
    else if (h.endsWith(`_${alias}`) || h.startsWith(`${alias}_`)) best = Math.max(best, 85)
    else if (h.includes(alias) || alias.includes(h)) best = Math.max(best, Math.min(75, 50 + Math.min(h.length, alias.length)))
  }
  return best
}

const bestHeader = (headers: string[], aliases: string[]) => {
  let best = ''
  let score = 0
  for (const header of headers) {
    const current = scoreHeader(header, aliases)
    if (current > score) {
      score = current
      best = header
    }
  }
  return score >= 60 ? best : ''
}

export const autoMap = (origin: Dataset, target: Dataset): FieldMapping[] => CHECKLIST_FIELDS.map(field => ({
  fieldId: field.id,
  originHeader: bestHeader(origin.headers, field.aliases),
  targetHeader: bestHeader(target.headers, field.aliases),
}))

export const detectStatusHeader = (dataset: Dataset) => bestHeader(dataset.headers, RECORD_STATUS_ALIASES)

export const mappingCoverage = (mapping: FieldMapping[]) => {
  const both = mapping.filter(m => m.originHeader && m.targetHeader).length
  const originOnly = mapping.filter(m => m.originHeader && !m.targetHeader).length
  const targetOnly = mapping.filter(m => !m.originHeader && m.targetHeader).length
  const none = mapping.filter(m => !m.originHeader && !m.targetHeader).length
  return { both, originOnly, targetOnly, none, total: mapping.length }
}
