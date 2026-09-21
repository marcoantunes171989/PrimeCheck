import { CHECKLIST_FIELDS } from '../config/checklist'
import type {
  CellValue,
  ClientComparison,
  ComparisonFieldResult,
  ComparisonReport,
  Dataset,
  DuplicateItem,
  FieldDefinition,
  FieldMapping,
  FieldSummary,
  Severity,
} from '../types'
import {
  asText,
  hasReplacementCharacter,
  isInactiveValue,
  normalizeForField,
  validateCpfCnpj,
} from './normalizers'
import { detectStatusHeader } from './mapping'

const mappingByField = (mapping: FieldMapping[]) => new Map(mapping.map(item => [item.fieldId, item]))
const fieldById = new Map(CHECKLIST_FIELDS.map(field => [field.id, field]))

const getMappedValue = (row: Record<string, CellValue> | undefined, header: string) => row && header ? row[header] : ''

const statusPriority: Record<Severity, number> = {
  'CONFORME': 0,
  'NÃO VALIDÁVEL': 1,
  'ATENÇÃO': 2,
  'NÃO IMPORTADO': 3,
  'DIVERGENTE': 4,
}

const compareDocument = (origin: CellValue, target: CellValue): Pick<ComparisonFieldResult, 'status' | 'reason'> => {
  const o = validateCpfCnpj(origin)
  const t = validateCpfCnpj(target)
  const ov = o.normalized
  const tv = t.normalized

  if (ov === tv) {
    if (o.status === 'VÁLIDO') return { status: 'CONFORME', reason: `${o.type} preservado no destino e válido.` }
    if (o.status === 'AUSENTE') return { status: 'CONFORME', reason: 'Documento ausente em origem e destino.' }
    return { status: 'ATENÇÃO', reason: `Documento preservado, porém inválido na origem: ${o.detail}` }
  }

  if (o.status === 'VÁLIDO') {
    return {
      status: 'DIVERGENTE',
      reason: `ERRO: ${o.type.replace('_ALFANUMERICO',' alfanumérico')} válido na origem, mas o destino trouxe valor diferente${tv ? ` (${asText(target)})` : ' ou vazio'}. Documento válido deve ser preservado.`,
    }
  }

  return {
    status: 'ATENÇÃO',
    reason: o.status === 'AUSENTE'
      ? `AVISO: CPF/CNPJ ausente na origem e destino trouxe ${tv ? 'valor/código interno' : 'vazio'}. Revisar a regra de geração, sem classificar como perda de documento válido.`
      : `AVISO: CPF/CNPJ inválido na origem (${o.detail}) e destino está diferente. Revisar manualmente; não há documento válido de origem a preservar.`,
  }
}

const compareField = (field: FieldDefinition, origin: CellValue, target: CellValue): Pick<ComparisonFieldResult, 'status' | 'reason'> => {
  if (field.kind === 'document') return compareDocument(origin, target)

  const originText = asText(origin)
  const targetText = asText(target)
  if (hasReplacementCharacter(target)) {
    return { status: 'DIVERGENTE', reason: 'Destino contém caractere de substituição (�), indicando possível corrupção de codificação/acentuação.' }
  }

  const o = normalizeForField(origin, field)
  const t = normalizeForField(target, field)
  if (o === t) return { status: 'CONFORME', reason: 'Valores equivalentes após normalização.' }

  if (!originText && !targetText) return { status: 'CONFORME', reason: 'Campo vazio nos dois arquivos.' }

  if (!originText && targetText) {
    if (field.kind === 'ie' && ['ISENTO','ISENTA'].includes(t)) {
      return { status: 'ATENÇÃO', reason: 'Origem sem inscrição estadual e destino preenchido automaticamente como ISENTO. Confirmar regra da conversão.' }
    }
    return { status: 'ATENÇÃO', reason: 'Origem sem informação e destino preenchido. Confirmar regra/default aplicado na conversão.' }
  }

  if (originText && !targetText) return { status: 'DIVERGENTE', reason: 'Existe informação na origem, mas o campo está vazio no destino.' }

  if (field.id === 'rg' && /X$/i.test(originText.replace(/\W/g,'')) && !/X$/i.test(targetText.replace(/\W/g,''))) {
    return { status: 'DIVERGENTE', reason: 'RG na origem possui dígito verificador X e o destino não preservou esse caractere.' }
  }

  if (field.id === 'contato' && targetText.length < originText.length && targetText.length <= 35 && originText.startsWith(targetText)) {
    return { status: 'DIVERGENTE', reason: `Possível truncamento: origem possui ${originText.length} caracteres e destino ${targetText.length}.` }
  }

  return { status: 'DIVERGENTE', reason: 'Valores diferentes após normalização; revisar conversão.' }
}


export type ManualReviewStatus = 'AUTO' | 'CONFORME' | 'ATENÇÃO' | 'DIVERGENTE' | 'NÃO VALIDÁVEL'

export interface ManualAdjustmentInput {
  adjustedValue: string
  status: ManualReviewStatus
  note: string
}

const detectInactive = (row: Record<string, CellValue>, statusHeader: string) => statusHeader ? isInactiveValue(statusHeader, row[statusHeader]) : false

const createFieldResult = (
  field: FieldDefinition,
  map: FieldMapping | undefined,
  originRow: Record<string, CellValue>,
  targetRow: Record<string, CellValue> | undefined,
): ComparisonFieldResult => {
  if (!map?.originHeader || !map?.targetHeader) {
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      group: field.group,
      originValue: map?.originHeader ? asText(originRow[map.originHeader]) : '',
      targetValue: map?.targetHeader && targetRow ? asText(targetRow[map.targetHeader]) : '',
      status: 'NÃO VALIDÁVEL',
      reason: !map?.originHeader && !map?.targetHeader
        ? 'Campo não foi identificado em nenhum dos arquivos.'
        : !map?.originHeader
          ? 'Campo existe no destino, mas não foi mapeado na origem.'
          : 'Campo existe na origem, mas não foi mapeado no destino.',
    }
  }

  const originValue = getMappedValue(originRow, map.originHeader)
  const targetValue = getMappedValue(targetRow, map.targetHeader)
  const compared = compareField(field, originValue, targetValue)
  return {
    fieldId: field.id,
    fieldLabel: field.label,
    group: field.group,
    originValue: asText(originValue),
    targetValue: asText(targetValue),
    ...compared,
  }
}

const duplicateScan = (dataset: Dataset, side: 'ORIGEM' | 'DESTINO', mapping: FieldMapping[], keyField: FieldDefinition, nameField: FieldDefinition | undefined) => {
  const result: DuplicateItem[] = []
  const mapIndex = mappingByField(mapping)
  const keyMap = mapIndex.get(keyField.id)
  const nameMap = nameField ? mapIndex.get(nameField.id) : undefined
  const keyHeader = side === 'ORIGEM' ? keyMap?.originHeader : keyMap?.targetHeader
  const nameHeader = side === 'ORIGEM' ? nameMap?.originHeader : nameMap?.targetHeader

  for (const fieldId of ['cpfCnpj','ie']) {
    const field = fieldById.get(fieldId)
    const map = mapIndex.get(fieldId)
    if (!field || !map) continue
    const header = side === 'ORIGEM' ? map.originHeader : map.targetHeader
    if (!header) continue

    const groups = new Map<string, Array<Record<string, CellValue>>>()
    dataset.rows.forEach(row => {
      const normalized = normalizeForField(row[header], field)
      if (!normalized || normalized === 'ISENTO' || normalized === 'ISENTA') return
      const arr = groups.get(normalized) ?? []
      arr.push(row)
      groups.set(normalized, arr)
    })

    groups.forEach((records, value) => {
      if (records.length < 2) return
      result.push({
        side,
        fieldId,
        fieldLabel: field.label,
        normalizedValue: value,
        count: records.length,
        records: records.map(row => ({
          key: keyHeader ? normalizeForField(row[keyHeader], keyField) : '',
          name: nameHeader ? asText(row[nameHeader]) : '',
        })),
      })
    })
  }
  return result
}

const summarizeFields = (clients: ClientComparison[]): FieldSummary[] => CHECKLIST_FIELDS.map(field => {
  const results = clients.flatMap(client => client.fields).filter(result => result.fieldId === field.id)
  const conform = results.filter(r => r.status === 'CONFORME').length
  const divergent = results.filter(r => r.status === 'DIVERGENTE').length
  const attention = results.filter(r => r.status === 'ATENÇÃO').length
  const notValidatable = results.filter(r => r.status === 'NÃO VALIDÁVEL').length
  const valid = conform + divergent + attention
  return {
    fieldId: field.id,
    fieldLabel: field.label,
    group: field.group,
    conform,
    divergent,
    attention,
    notValidatable,
    conformityPercent: valid ? conform / valid * 100 : null,
  }
})

export const compareDatasets = (origin: Dataset, target: Dataset, mapping: FieldMapping[]): ComparisonReport => {
  const mapIndex = mappingByField(mapping)
  const keyField = CHECKLIST_FIELDS.find(f => f.requiredForMatch)!
  const keyMap = mapIndex.get(keyField.id)
  if (!keyMap?.originHeader || !keyMap?.targetHeader) throw new Error('Mapeie o Código interno nos arquivos de origem e destino antes de analisar.')

  const nameField = CHECKLIST_FIELDS.find(f => f.id === 'nome')
  const nameMap = nameField ? mapIndex.get(nameField.id) : undefined
  const originStatusHeader = detectStatusHeader(origin)

  const targetByKey = new Map<string, Record<string, CellValue>>()
  target.rows.forEach(row => {
    const key = normalizeForField(row[keyMap.targetHeader], keyField)
    if (key && !targetByKey.has(key)) targetByKey.set(key, row)
  })

  const originKeys = new Set<string>()
  const clients: ClientComparison[] = origin.rows.map((originRow, index) => {
    const key = normalizeForField(originRow[keyMap.originHeader], keyField) || `SEM_CHAVE_${index + 1}`
    originKeys.add(key)
    const targetRow = targetByKey.get(key)
    const inactive = detectInactive(originRow, originStatusHeader)
    const name = nameMap?.originHeader ? asText(originRow[nameMap.originHeader]) : ''

    if (!targetRow) {
      return {
        key,
        name,
        originRow,
        found: false,
        originInactive: inactive,
        status: inactive ? 'NÃO IMPORTADO' : 'DIVERGENTE',
        divergentCount: inactive ? 0 : 1,
        attentionCount: inactive ? 1 : 0,
        fields: CHECKLIST_FIELDS.map(field => ({
          fieldId: field.id,
          fieldLabel: field.label,
          group: field.group,
          originValue: mapIndex.get(field.id)?.originHeader ? asText(originRow[mapIndex.get(field.id)!.originHeader]) : '',
          targetValue: '',
          status: inactive ? 'NÃO VALIDÁVEL' : 'DIVERGENTE',
          reason: inactive
            ? 'Registro marcado como inativo na origem e não localizado no destino.'
            : 'Registro da origem não foi localizado no destino pela chave configurada.',
        })),
      }
    }

    const fields = CHECKLIST_FIELDS.map(field => createFieldResult(field, mapIndex.get(field.id), originRow, targetRow))
    const divergentCount = fields.filter(f => f.status === 'DIVERGENTE').length
    const attentionCount = fields.filter(f => f.status === 'ATENÇÃO').length
    const status: Severity = divergentCount ? 'DIVERGENTE' : attentionCount ? 'ATENÇÃO' : 'CONFORME'
    return { key, name, originRow, targetRow, found: true, originInactive: inactive, status, divergentCount, attentionCount, fields }
  })

  const targetOnly = target.rows.flatMap(row => {
    const key = normalizeForField(row[keyMap.targetHeader], keyField)
    if (!key || originKeys.has(key)) return []
    return [{ key, name: nameMap?.targetHeader ? asText(row[nameMap.targetHeader]) : '', row }]
  })

  const duplicates = [
    ...duplicateScan(origin, 'ORIGEM', mapping, keyField, nameField),
    ...duplicateScan(target, 'DESTINO', mapping, keyField, nameField),
  ]
  const fieldSummary = summarizeFields(clients.filter(c => c.found))
  const validFieldResults = clients.filter(c => c.found).flatMap(c => c.fields).filter(f => f.status !== 'NÃO VALIDÁVEL')

  return {
    generatedAt: new Date().toISOString(),
    mapping,
    clients,
    duplicates,
    fieldSummary,
    targetOnly,
    summary: {
      originTotal: origin.rows.length,
      targetTotal: target.rows.length,
      foundTotal: clients.filter(c => c.found).length,
      conformClients: clients.filter(c => c.status === 'CONFORME').length,
      divergentClients: clients.filter(c => c.status === 'DIVERGENTE').length,
      attentionClients: clients.filter(c => c.status === 'ATENÇÃO').length,
      notImportedClients: clients.filter(c => c.status === 'NÃO IMPORTADO').length,
      targetOnlyClients: targetOnly.length,
      validTests: validFieldResults.length,
      conformTests: validFieldResults.filter(f => f.status === 'CONFORME').length,
    },
  }
}


const rebuildReport = (report: ComparisonReport, clients: ClientComparison[]): ComparisonReport => {
  const fieldSummary = summarizeFields(clients.filter(client => client.found))
  const validFieldResults = clients
    .filter(client => client.found)
    .flatMap(client => client.fields)
    .filter(field => field.status !== 'NÃO VALIDÁVEL')

  return {
    ...report,
    generatedAt: new Date().toISOString(),
    clients,
    fieldSummary,
    summary: {
      ...report.summary,
      foundTotal: clients.filter(client => client.found).length,
      conformClients: clients.filter(client => client.status === 'CONFORME').length,
      divergentClients: clients.filter(client => client.status === 'DIVERGENTE').length,
      attentionClients: clients.filter(client => client.status === 'ATENÇÃO').length,
      notImportedClients: clients.filter(client => client.status === 'NÃO IMPORTADO').length,
      validTests: validFieldResults.length,
      conformTests: validFieldResults.filter(field => field.status === 'CONFORME').length,
    },
  }
}

const rebuildClientFromFields = (
  client: ClientComparison,
  fields: ComparisonFieldResult[],
): ClientComparison => {
  if (!client.found) return { ...client, fields }

  const divergentCount = fields.filter(field => field.status === 'DIVERGENTE').length
  const attentionCount = fields.filter(field => field.status === 'ATENÇÃO').length
  const status: Severity = divergentCount
    ? 'DIVERGENTE'
    : attentionCount
      ? 'ATENÇÃO'
      : 'CONFORME'

  return { ...client, fields, divergentCount, attentionCount, status }
}

export const applyManualFieldAdjustment = (
  report: ComparisonReport,
  clientKey: string,
  fieldId: string,
  input: ManualAdjustmentInput,
): ComparisonReport => {
  const definition = fieldById.get(fieldId)
  if (!definition) throw new Error('Campo de homologação não encontrado.')

  const clients = report.clients.map(client => {
    if (client.key !== clientKey) return client
    if (!client.found) return client

    const fields = client.fields.map(field => {
      if (field.fieldId !== fieldId) return field

      const originalTargetValue =
        field.manualAdjustment?.originalTargetValue ?? field.targetValue
      const adjustedValue = input.adjustedValue.trim()
      const automatic = compareField(definition, field.originValue, adjustedValue)

      const status: Severity =
        input.status === 'AUTO' ? automatic.status : input.status

      const note = input.note.trim()
      const classification =
        input.status === 'AUTO'
          ? automatic.reason
          : `Classificação manual definida como ${status}.`

      return {
        ...field,
        targetValue: adjustedValue,
        status,
        reason: `AJUSTE MANUAL: ${classification}${note ? ` Observação: ${note}` : ''}`,
        manualAdjustment: {
          originalTargetValue,
          adjustedValue,
          status,
          note,
          adjustedAt: new Date().toISOString(),
        },
      }
    })

    return rebuildClientFromFields(client, fields)
  })

  return rebuildReport(report, clients)
}

export const revertManualFieldAdjustment = (
  report: ComparisonReport,
  clientKey: string,
  fieldId: string,
): ComparisonReport => {
  const definition = fieldById.get(fieldId)
  if (!definition) throw new Error('Campo de homologação não encontrado.')

  const clients = report.clients.map(client => {
    if (client.key !== clientKey) return client
    if (!client.found) return client

    const fields = client.fields.map(field => {
      if (field.fieldId !== fieldId || !field.manualAdjustment) return field

      const targetValue = field.manualAdjustment.originalTargetValue
      const compared = compareField(definition, field.originValue, targetValue)
      const { manualAdjustment: _manualAdjustment, ...rest } = field

      return {
        ...rest,
        targetValue,
        status: compared.status,
        reason: compared.reason,
      }
    })

    return rebuildClientFromFields(client, fields)
  })

  return rebuildReport(report, clients)
}

export const worstStatus = (statuses: Severity[]) => [...statuses].sort((a,b) => statusPriority[b] - statusPriority[a])[0] ?? 'CONFORME'
