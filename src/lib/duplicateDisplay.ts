import type { DuplicateRecord } from '../types'

export const PREFERRED_DUPLICATE_EXTRA_IDS = [
  'apelido',
  'descricaoReduzida',
  'cpfCnpj',
  'ie',
  'rg',
  'telefone',
  'celular',
  'cidade',
  'uf',
  'pessoaTipo',
  'email',
  'codigoBarras',
  'unidade',
  'ncm',
] as const

export interface DuplicateDisplayContext {
  fieldId: string
  fieldLabel: string
  normalizedValue: string
  nameLabel: string
}

export interface DuplicateDisplayField {
  id: string
  label: string
  value: string
}

const preferredExtraOrder = new Map<string, number>(
  PREFERRED_DUPLICATE_EXTRA_IDS.map((id, index) => [id, index]),
)

export const isMonoDuplicateField = (fieldId: string) => (
  fieldId === '__codigo'
  || fieldId === 'cpfCnpj'
  || fieldId === 'ie'
  || fieldId === 'rg'
  || fieldId === 'codigoBarras'
)

export function buildRecordDisplayFields(
  record: DuplicateRecord,
  ctx: DuplicateDisplayContext,
): DuplicateDisplayField[] {
  const fields: DuplicateDisplayField[] = [
    { id: '__codigo', label: 'Código', value: record.key.trim() },
    { id: '__nome', label: ctx.nameLabel, value: record.name.trim() },
  ]
  const used = new Set(fields.map(field => field.id))

  if (ctx.fieldId && ctx.fieldId !== 'codigoInterno' && ctx.fieldId !== 'nome' && !used.has(ctx.fieldId)) {
    fields.push({
      id: ctx.fieldId,
      label: ctx.fieldLabel,
      value: (record.rawValue.trim() || ctx.normalizedValue).trim(),
    })
    used.add(ctx.fieldId)
  }

  const extras = record.extras.filter(extra => extra.value.trim())
  extras.sort((left, right) => {
    const leftRank = preferredExtraOrder.get(left.id) ?? 100
    const rightRank = preferredExtraOrder.get(right.id) ?? 100
    if (leftRank !== rightRank) return leftRank - rightRank
    return left.label.localeCompare(right.label, 'pt-BR')
  })

  for (const extra of extras) {
    if (used.has(extra.id)) continue
    used.add(extra.id)
    fields.push({ id: extra.id, label: extra.label, value: extra.value.trim() })
  }

  return fields
}

export function buildGroupDisplayColumns(
  records: DuplicateRecord[],
  ctx: DuplicateDisplayContext,
) {
  const columns: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()
  for (const record of records) {
    for (const field of buildRecordDisplayFields(record, ctx)) {
      if (seen.has(field.id)) continue
      seen.add(field.id)
      columns.push({ id: field.id, label: field.label })
    }
  }
  return columns
}

export function recordValueMap(record: DuplicateRecord, ctx: DuplicateDisplayContext) {
  return new Map(buildRecordDisplayFields(record, ctx).map(field => [field.id, field.value]))
}

export const sideLabel = (side: 'ORIGEM' | 'DESTINO') => (side === 'ORIGEM' ? 'Origem' : 'Destino')
