import type {
  CellValue,
  ClientComparison,
  ComparisonFieldResult,
  ComparisonReport,
  Dataset,
  DuplicateItem,
  EntityProfile,
  FieldDefinition,
  FieldMapping,
  FieldSummary,
  Severity,
} from '../types'
import { getEntityProfile } from '../config/entities'
import { validateInscricaoEstadual, type UfCode } from '@br-validators/core/inscricao-estadual'
import {
  asText,
  formatDateForDisplay,
  hasReplacementCharacter,
  isInactiveValue,
  normalizeAddress,
  normalizeAddressNumber,
  normalizeAlphanumericDocument,
  normalizeClientName,
  normalizeComparableCharacters,
  normalizeForField,
  normalizeIE,
  normalizeLooseText,
  normalizeState,
  normalizeText,
  onlyDigits,
  validateCpfCnpj,
} from './normalizers'
import { detectStatusHeader } from './mapping'
import { duplicateCategory } from './duplicates'

const mappingByField = (mapping: FieldMapping[]) => new Map(mapping.map(item => [item.fieldId, item]))

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
  const targetStatus = t.status === 'AUSENTE'
    ? 'destino vazio'
    : `destino ${t.status.toLocaleLowerCase('pt-BR')}: ${t.detail}`

  if (ov === tv) {
    if (o.status === 'VÁLIDO') {
      return {
        status: 'CONFORME',
        reason: `${o.type.replace('_ALFANUMERICO', ' alfanumérico')} válido na origem (${o.detail}) e preservado no destino. ${targetStatus}.`,
      }
    }
    if (o.status === 'AUSENTE') return { status: 'CONFORME', reason: 'CPF/CNPJ ausente em origem e destino.' }
    return {
      status: 'ATENÇÃO',
      reason: `AVISO: CPF/CNPJ preservado, porém inválido na origem (${o.detail}). ${targetStatus}. Revisar manualmente.`,
    }
  }

  if (o.status === 'VÁLIDO') {
    return {
      status: 'DIVERGENTE',
      reason: `ERRO: ${o.type.replace('_ALFANUMERICO',' alfanumérico')} válido na origem (${o.detail}), mas o destino trouxe valor diferente${tv ? ` (${asText(target)})` : ' ou vazio'}. ${targetStatus}. Documento válido da origem deve ser preservado.`,
    }
  }

  return {
    status: 'ATENÇÃO',
    reason: o.status === 'AUSENTE'
      ? `AVISO: CPF/CNPJ ausente na origem e destino trouxe ${tv ? `valor (${asText(target)}); ${targetStatus}` : 'vazio'}. Revisar a regra de geração sem classificar como perda de documento válido.`
      : `AVISO: CPF/CNPJ inválido na origem (${o.detail}) e destino ${tv ? `foi preenchido com valor diferente (${asText(target)}); ${targetStatus}` : 'ficou vazio'}. Revisar manualmente; não há documento válido de origem a preservar.`,
  }
}

const IE_UFS: UfCode[] = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]
const IE_UF_SET = new Set<string>(IE_UFS)

type IeAssessment = {
  normalized: string
  status: 'VÁLIDA' | 'INVÁLIDA' | 'AUSENTE' | 'ISENTO' | 'NÃO VALIDADA'
  detail: string
}

const assessIe = (value: CellValue, ufValue: CellValue): IeAssessment => {
  const normalized = normalizeIE(value)
  if (!normalized) {
    return { normalized, status: 'AUSENTE', detail: 'Inscrição estadual não informada.' }
  }
  if (normalized === 'ISENTO') {
    return { normalized, status: 'ISENTO', detail: 'Cadastro informado como ISENTO/ISENTA.' }
  }

  const uf = normalizeState(ufValue)
  if (!IE_UF_SET.has(uf)) {
    return {
      normalized,
      status: 'NÃO VALIDADA',
      detail: `UF da inscrição estadual não identificada ou inválida (${uf || 'não informada'}).`,
    }
  }

  try {
    const result = validateInscricaoEstadual(asText(value), { uf: uf as UfCode })
    return result.ok
      ? { normalized, status: 'VÁLIDA', detail: `Inscrição estadual válida para a UF ${uf}.` }
      : { normalized, status: 'INVÁLIDA', detail: result.message || `Inscrição estadual inválida para a UF ${uf}.` }
  } catch {
    return {
      normalized,
      status: 'NÃO VALIDADA',
      detail: `Não foi possível validar a inscrição estadual para a UF ${uf}.`,
    }
  }
}

const compareInscricaoEstadual = (
  origin: CellValue,
  target: CellValue,
  originUf: CellValue,
  targetUf: CellValue,
): Pick<ComparisonFieldResult, 'status' | 'reason'> => {
  const originText = asText(origin)
  const targetText = asText(target)

  if (hasReplacementCharacter(target)) {
    return { status: 'DIVERGENTE', reason: 'Destino contém caractere de substituição (�), indicando possível corrupção de codificação/acentuação.' }
  }

  if (!originText && !targetText) {
    return { status: 'CONFORME', reason: 'Inscrição estadual ausente em origem e destino.' }
  }

  const originCharacters = normalizeComparableCharacters(origin)
  const targetCharacters = normalizeComparableCharacters(target)
  if (originCharacters && originCharacters === targetCharacters) {
    return {
      status: 'CONFORME',
      reason: 'Inscrição estadual preservada: a sequência de letras e números é idêntica na origem e no destino, desconsiderando apenas máscara/formatação.',
    }
  }

  const o = assessIe(origin, originUf)
  const t = assessIe(target, targetUf)
  const same = o.normalized === t.normalized

  if (same) {
    return {
      status: 'CONFORME',
      reason: 'Inscrição estadual equivalente após normalização; diferenças apenas de apresentação não alteram a conformidade.',
    }
  }

  if (o.status === 'VÁLIDA') {
    return {
      status: 'DIVERGENTE',
      reason: `ERRO: inscrição estadual válida na origem (${o.detail}), mas o destino trouxe valor diferente${t.normalized ? ` (${asText(target)})` : ' ou vazio'}. Destino: ${t.detail} O valor válido da origem deve ser preservado.`,
    }
  }

  if (o.status === 'AUSENTE') {
    return {
      status: 'ATENÇÃO',
      reason: `AVISO: inscrição estadual ausente na origem e destino ${t.normalized ? `foi preenchido com ${asText(target)}` : 'permaneceu vazio'}. Destino: ${t.detail}`,
    }
  }

  if (o.status === 'ISENTO') {
    return {
      status: 'ATENÇÃO',
      reason: `AVISO: origem informada como ISENTO/ISENTA e destino trouxe valor diferente${t.normalized ? ` (${asText(target)})` : ' ou vazio'}. Destino: ${t.detail}`,
    }
  }

  return {
    status: 'ATENÇÃO',
    reason: `AVISO: inscrição estadual ${o.status.toLocaleLowerCase('pt-BR')} na origem (${o.detail}) e destino trouxe valor diferente${t.normalized ? ` (${asText(target)})` : ' ou vazio'}. Destino: ${t.detail} Revisar manualmente; não há IE válida de origem confirmada para preservar.`,
  }
}

const LOOSE_TEXT_FIELDS = new Set([
  'apelido',
  'endereco',
  'complemento',
  'bairro',
  'cidade',
  'contato',
  'observacao',
  'condicaoPagamento',
  'descricaoReduzida',
  'email',
  'marca',
  'departamento',
  'secao',
  'grupo',
  'subgrupo',
  'fornecedor',
])

const TRUNCATION_FIELDS = new Set([
  'nome',
  'apelido',
  'endereco',
  'complemento',
  'contato',
  'observacao',
  'bairro',
  'cidade',
  'descricaoReduzida',
])

const comparableText = (field: FieldDefinition, value: CellValue) => {
  if (field.id === 'nome') return normalizeClientName(value)
  if (field.id === 'endereco') return normalizeAddress(value)
  if (field.id === 'numeroEndereco') return normalizeAddressNumber(value)
  if (LOOSE_TEXT_FIELDS.has(field.id)) return normalizeLooseText(value)
  return normalizeForField(value, field)
}

const isTruncatedValue = (originNormalized: string, targetNormalized: string) => {
  if (!originNormalized || !targetNormalized) return false
  if (targetNormalized.length < 12) return false
  if (originNormalized === targetNormalized) return false
  if (!originNormalized.startsWith(targetNormalized)) return false
  return originNormalized.length - targetNormalized.length >= 3
}

const characterCount = (value: CellValue) => Array.from(asText(value)).length

const characterDifferenceDetail = (
  field: FieldDefinition,
  origin: CellValue,
  target: CellValue,
) => {
  if (field.kind !== 'text') return ''

  const originLength = characterCount(origin)
  const targetLength = characterCount(target)
  const difference = targetLength - originLength
  const relation = difference === 0
    ? 'mesma quantidade de caracteres, porém conteúdo diferente'
    : difference > 0
      ? `destino possui ${difference} ${difference === 1 ? 'caractere a mais' : 'caracteres a mais'}`
      : `destino possui ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'caractere a menos' : 'caracteres a menos'}`

  return ` Origem: ${originLength} ${originLength === 1 ? 'caractere' : 'caracteres'}; destino: ${targetLength} ${targetLength === 1 ? 'caractere' : 'caracteres'}; ${relation}.`
}

const compareField = (field: FieldDefinition, origin: CellValue, target: CellValue): Pick<ComparisonFieldResult, 'status' | 'reason'> => {
  const originText = asText(origin)
  const targetText = asText(target)

  if (!originText && !targetText) {
    return { status: 'CONFORME', reason: 'Campo vazio nos dois arquivos.' }
  }

  if (field.kind !== 'money') {
    const originCharacters = normalizeComparableCharacters(origin)
    const targetCharacters = normalizeComparableCharacters(target)
    if (originCharacters && originCharacters === targetCharacters) {
      return {
        status: 'CONFORME',
        reason: 'Sequência de letras e números preservada entre origem e destino; máscara, pontuação e espaços de formatação foram desconsiderados.',
      }
    }
  }

  if (field.kind === 'document') return compareDocument(origin, target)

  if (field.id === 'nome') {
    const originName = normalizeClientName(origin)
    const targetName = normalizeClientName(target)
    if (originName && originName === targetName) {
      return { status: 'CONFORME', reason: 'Nome equivalente após normalização de acentos, pontuação, espaços e sufixo de código.' }
    }
  }

  if (field.id === 'endereco') {
    if (normalizeAddress(origin) === normalizeAddress(target)) {
      return { status: 'CONFORME', reason: 'Endereço equivalente após normalização de pontuação e Nº/N°.' }
    }
  }

  if (field.id === 'complemento' || field.id === 'bairro' || field.id === 'cidade') {
    if (normalizeLooseText(origin) === normalizeLooseText(target)) {
      return { status: 'CONFORME', reason: 'Endereço equivalente após normalização de pontuação e Nº/N°.' }
    }
  }

  if (field.id === 'numeroEndereco') {
    const oNumber = normalizeAddressNumber(origin)
    const tNumber = normalizeAddressNumber(target)
    if (oNumber === tNumber) {
      return { status: 'CONFORME', reason: 'Número de endereço equivalente após normalizar Nº/N°/No e pontuação.' }
    }
  }

  if (field.id === 'estadoCivil') {
    const o = normalizeText(origin)
    const t = normalizeText(target)
    if ((o === '0' && t === 'SOLTEIRO') || (o === 'SOLTEIRO' && t === '0')) {
      return { status: 'CONFORME', reason: 'Regra local aplicada: código 0 corresponde a Solteiro.' }
    }
  }

  if (field.id === 'statusCheque' || field.id === 'statusConvenio') {
    const o = normalizeText(origin)
    const t = normalizeText(target)
    if ((o === '0' && !t) || (o === '1' && t === '1')) {
      return { status: 'CONFORME', reason: 'Regra local aplicada: 0 corresponde a vazio e 1 corresponde a 1.' }
    }
  }

  if (field.id === 'empresaConvenio') {
    const o = normalizeText(origin)
    const t = normalizeText(target)
    if (o === '0' && !t) {
      return { status: 'CONFORME', reason: 'Regra local aplicada: código de convênio 0 corresponde a ausência de empresa convênio.' }
    }
  }
  if (hasReplacementCharacter(target)) {
    return { status: 'DIVERGENTE', reason: 'Destino contém caractere de substituição (�), indicando possível corrupção de codificação/acentuação.' }
  }

  if (field.id === 'rg') {
    const oRg = normalizeAlphanumericDocument(origin)
    const tRg = normalizeAlphanumericDocument(target)

    if (oRg === tRg) {
      return { status: 'CONFORME', reason: 'RG equivalente após remover máscara, pontuação e espaços.' }
    }

    if (oRg.endsWith('X') && oRg.slice(0, -1) === tRg) {
      return { status: 'DIVERGENTE', reason: 'RG na origem possui dígito verificador X e o destino não preservou esse caractere.' }
    }
  }

  if (field.id === 'cep') {
    const oCep = onlyDigits(origin)
    const tCep = onlyDigits(target)

    if (oCep === tCep) {
      return { status: 'CONFORME', reason: 'CEP equivalente após remover máscara e caracteres de formatação.' }
    }
  }

  const o = comparableText(field, origin)
  const t = comparableText(field, target)
  if (o === t) return { status: 'CONFORME', reason: 'Valores equivalentes após normalização.' }

  if (!originText && targetText) {
    if (field.kind === 'ie' && t === 'ISENTO') {
      return { status: 'ATENÇÃO', reason: 'Origem sem inscrição estadual e destino preenchido automaticamente como ISENTO. Confirmar regra da conversão.' }
    }
    return { status: 'ATENÇÃO', reason: 'Origem sem informação e destino preenchido. Confirmar regra/default aplicado na conversão.' }
  }

  if (originText && !targetText) return {
    status: 'DIVERGENTE',
    reason: 'Existe informação na origem, mas o campo está vazio no destino.' + characterDifferenceDetail(field, origin, target),
  }

  if (field.id === 'contato' && targetText.length < originText.length && targetText.length <= 35 && originText.startsWith(targetText)) {
    return {
      status: 'DIVERGENTE',
      reason: 'Possível truncamento identificado.' + characterDifferenceDetail(field, origin, target),
    }
  }

  if (TRUNCATION_FIELDS.has(field.id) && isTruncatedValue(o, t)) {
    return {
      status: 'DIVERGENTE',
      reason: 'Possível truncamento identificado.' + characterDifferenceDetail(field, origin, target),
    }
  }

  return {
    status: 'DIVERGENTE',
    reason: 'Valores diferentes após normalização; revisar conversão.' + characterDifferenceDetail(field, origin, target),
  }
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
  allMappings: Map<string, FieldMapping>,
): ComparisonFieldResult => {
  if (field.id === 'pessoaTipo' && map?.originHeader && targetRow) {
    const documentMap = allMappings.get('cpfCnpj')
    const targetDocument = documentMap?.targetHeader
      ? asText(targetRow[documentMap.targetHeader])
      : ''

    if (targetDocument) {
      const normalizedDocument = validateCpfCnpj(targetDocument).normalized
      const inferredTarget = normalizedDocument.length === 11
        ? 'F'
        : normalizedDocument.length === 14
          ? 'J'
          : ''

      if (inferredTarget) {
        const originValue = asText(originRow[map.originHeader])
        const compared = compareField(field, originValue, inferredTarget)
        return {
          fieldId: field.id,
          fieldLabel: field.label,
          group: field.group,
          originValue,
          targetValue: inferredTarget === 'F' ? 'PF (inferido pelo CPF)' : 'PJ (inferido pelo CNPJ)',
          ...compared,
        }
      }
    }
  }

  if (!map?.originHeader || !map?.targetHeader) {
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      group: field.group,
      originValue: map?.originHeader
        ? field.kind === 'date' ? formatDateForDisplay(originRow[map.originHeader]) : asText(originRow[map.originHeader])
        : '',
      targetValue: map?.targetHeader && targetRow
        ? field.kind === 'date' ? formatDateForDisplay(targetRow[map.targetHeader]) : asText(targetRow[map.targetHeader])
        : '',
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

  const compared = field.kind === 'ie'
    ? (() => {
        const ufMap = allMappings.get('uf')
        const originUf = ufMap?.originHeader ? getMappedValue(originRow, ufMap.originHeader) : ''
        const targetUf = ufMap?.targetHeader ? getMappedValue(targetRow, ufMap.targetHeader) : ''
        return compareInscricaoEstadual(originValue, targetValue, originUf, targetUf)
      })()
    : compareField(field, originValue, targetValue)
  return {
    fieldId: field.id,
    fieldLabel: field.label,
    group: field.group,
    originValue: field.kind === 'date' ? formatDateForDisplay(originValue) : asText(originValue),
    targetValue: field.kind === 'date' ? formatDateForDisplay(targetValue) : asText(targetValue),
    ...compared,
  }
}

const duplicateScan = (
  dataset: Dataset,
  side: 'ORIGEM' | 'DESTINO',
  mapping: FieldMapping[],
  profile: EntityProfile,
  keyFields: FieldDefinition[],
  nameField: FieldDefinition | undefined,
) => {
  const result: DuplicateItem[] = []
  const mapIndex = mappingByField(mapping)
  const nameMap = nameField ? mapIndex.get(nameField.id) : undefined
  const nameHeader = side === 'ORIGEM' ? nameMap?.originHeader : nameMap?.targetHeader
  const fieldById = new Map(profile.fields.map(field => [field.id, field]))

  const recordKey = (row: Record<string, CellValue>) => keyFields
    .map(keyField => {
      const keyMap = mapIndex.get(keyField.id)
      const header = side === 'ORIGEM' ? keyMap?.originHeader : keyMap?.targetHeader
      return header ? normalizeForField(row[header], keyField) : ''
    })
    .filter(Boolean)
    .join(' / ')

  for (const fieldId of profile.duplicateFieldIds) {
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

    const skipExtraIds = new Set([
      fieldId,
      ...keyFields.map(item => item.id),
      nameField?.id,
    ].filter(Boolean) as string[])
    const extraCandidates = [...profile.fields]
      .filter(item => !skipExtraIds.has(item.id))
      .sort((a, b) => extraFieldPriority(a) - extraFieldPriority(b) || a.label.localeCompare(b.label, 'pt-BR'))

    groups.forEach((records, value) => {
      if (records.length < 2) return
      result.push({
        side,
        fieldId,
        fieldLabel: field.label,
        fieldGroup: field.group,
        category: duplicateCategory(field),
        normalizedValue: value,
        count: records.length,
        records: records.map(row => ({
          key: recordKey(row),
          name: nameHeader ? asText(row[nameHeader]) : '',
          rawValue: asText(row[header]),
          extras: collectRecordExtras(row, extraCandidates, mapIndex, side),
        })),
      })
    })
  }
  return result
}

const extraFieldPriority = (field: FieldDefinition) => {
  if (field.kind === 'document') return 0
  if (field.kind === 'ie') return 1
  if (field.id === 'apelido' || field.id === 'nomeFantasia' || field.id === 'fantasia' || field.id === 'descricaoReduzida') return 2
  if (field.id === 'rg') return 3
  if (field.kind === 'phone') return 4
  if (field.id === 'email' || field.id === 'pessoaTipo' || field.id === 'cidade' || field.id === 'uf') return 5
  return 8
}

const collectRecordExtras = (
  row: Record<string, CellValue>,
  candidates: FieldDefinition[],
  mapIndex: Map<string, FieldMapping>,
  side: 'ORIGEM' | 'DESTINO',
) => {
  const extras: Array<{ id: string; label: string; value: string }> = []
  for (const item of candidates) {
    if (extras.length >= 10) break
    const map = mapIndex.get(item.id)
    const header = side === 'ORIGEM' ? map?.originHeader : map?.targetHeader
    if (!header) continue
    const value = asText(row[header]).trim()
    if (!value) continue
    extras.push({ id: item.id, label: item.label, value })
  }
  return extras
}

const summarizeFields = (clients: ClientComparison[], fields: FieldDefinition[]): FieldSummary[] => fields.map(field => {
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

export const compareDatasets = (
  origin: Dataset,
  target: Dataset,
  mapping: FieldMapping[],
  profile: EntityProfile,
): ComparisonReport => {
  const mapIndex = mappingByField(mapping)
  const keyFields = profile.fields.filter(field => field.requiredForMatch)
  const keyMappings = keyFields.map(field => ({ field, map: mapIndex.get(field.id) }))
  const invalidKey = keyMappings.find(item => !item.map?.originHeader || !item.map?.targetHeader)
  if (!keyFields.length || invalidKey) {
    const required = keyFields.map(field => field.label).join(' + ') || 'chave do registro'
    throw new Error(`Mapeie ${required} nos arquivos de origem e destino antes de analisar.`)
  }

  const compositeKey = (
    row: Record<string, CellValue>,
    side: 'ORIGEM' | 'DESTINO',
  ) => keyMappings
    .map(({ field, map }) => {
      const header = side === 'ORIGEM' ? map!.originHeader : map!.targetHeader
      return normalizeForField(row[header], field)
    })
    .join('¦')

  const displayKey = (
    row: Record<string, CellValue>,
    side: 'ORIGEM' | 'DESTINO',
  ) => keyMappings
    .map(({ field, map }) => {
      const header = side === 'ORIGEM' ? map!.originHeader : map!.targetHeader
      return normalizeForField(row[header], field)
    })
    .filter(Boolean)
    .join(' / ')

  const nameField = profile.fields.find(field => field.id === profile.nameFieldId)
  const nameMap = nameField ? mapIndex.get(nameField.id) : undefined
  const originStatusHeader = detectStatusHeader(origin, profile.statusAliases)

  const targetByKey = new Map<string, Record<string, CellValue>>()
  target.rows.forEach(row => {
    const key = compositeKey(row, 'DESTINO')
    if (key && !targetByKey.has(key)) targetByKey.set(key, row)
  })

  const originKeys = new Set<string>()
  const clients: ClientComparison[] = origin.rows.map((originRow, index) => {
    const matchKey = compositeKey(originRow, 'ORIGEM')
    const key = displayKey(originRow, 'ORIGEM') || `SEM_CHAVE_${index + 1}`
    if (matchKey) originKeys.add(matchKey)
    const targetRow = matchKey ? targetByKey.get(matchKey) : undefined
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
        fields: profile.fields.map(field => ({
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

    const fields = profile.fields.map(field => createFieldResult(field, mapIndex.get(field.id), originRow, targetRow, mapIndex))
    const divergentCount = fields.filter(f => f.status === 'DIVERGENTE').length
    const attentionCount = fields.filter(f => f.status === 'ATENÇÃO').length
    const status: Severity = divergentCount ? 'DIVERGENTE' : attentionCount ? 'ATENÇÃO' : 'CONFORME'
    return { key, name, originRow, targetRow, found: true, originInactive: inactive, status, divergentCount, attentionCount, fields }
  })

  const targetOnly = target.rows.flatMap(row => {
    const matchKey = compositeKey(row, 'DESTINO')
    if (!matchKey || originKeys.has(matchKey)) return []
    return [{
      key: displayKey(row, 'DESTINO'),
      name: nameMap?.targetHeader ? asText(row[nameMap.targetHeader]) : '',
      row,
    }]
  })

  const duplicates = [
    ...duplicateScan(origin, 'ORIGEM', mapping, profile, keyFields, nameField),
    ...duplicateScan(target, 'DESTINO', mapping, profile, keyFields, nameField),
  ]
  const fieldSummary = summarizeFields(clients.filter(c => c.found), profile.fields)
  const validFieldResults = clients.filter(c => c.found).flatMap(c => c.fields).filter(f => f.status !== 'NÃO VALIDÁVEL')

  return {
    generatedAt: new Date().toISOString(),
    profileId: profile.id,
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
  const fields = getEntityProfile(report.profileId).fields
  const fieldSummary = summarizeFields(clients.filter(client => client.found), fields)
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
  const definition = getEntityProfile(report.profileId).fields.find(field => field.id === fieldId)
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

      const status: Exclude<Severity, 'NÃO IMPORTADO'> =
        input.status === 'AUTO'
          ? automatic.status as Exclude<Severity, 'NÃO IMPORTADO'>
          : input.status

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
  const definition = getEntityProfile(report.profileId).fields.find(field => field.id === fieldId)
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
