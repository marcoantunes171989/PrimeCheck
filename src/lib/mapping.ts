import type { Dataset, EntityProfile, FieldDefinition, FieldMapping } from '../types'
import { normalizeHeader } from './normalizers'

const GENERIC_TOKENS = new Set([
  'TAB','TB','CAD','CADASTRO','DADOS','CLIENTE','CLI','PESSOA','PESSOAS',
  'DES','DESC','DESCRICAO','NUM','NUMERO','COD','CODIGO','VALOR','VLR',
  'FLG','IND','FLAG','CAMPO','INFO','INFORMACAO',
])

const GENERIC_BARE_HEADERS = new Set([
  'CODIGO', 'NOME', 'DESCRICAO', 'STATUS', 'SITUACAO', 'VALOR', 'TIPO',
  'GRUPO', 'EMPRESA', 'CONVENIO', 'DOCUMENTO', 'OBS', 'OBSERVACAO',
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

const bigramSimilarity = (a: string, b: string) => {
  const left = a.replace(/_/g, '')
  const right = b.replace(/_/g, '')
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0

  const leftPairs = new Map<string, number>()
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2)
    leftPairs.set(pair, (leftPairs.get(pair) ?? 0) + 1)
  }

  let matches = 0
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2)
    const available = leftPairs.get(pair) ?? 0
    if (available > 0) {
      matches += 1
      leftPairs.set(pair, available - 1)
    }
  }

  return (2 * matches) / ((left.length - 1) + (right.length - 1))
}

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

export const scoreHeader = (header: string, aliases: string[]) => {
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
    if (similarity >= 0.75) {
      best = Math.max(best, 88)
      continue
    }
    if (similarity >= 0.60) best = Math.max(best, 82)
    else if (similarity >= 0.45) best = Math.max(best, 74)

    const minLength = Math.min(h.length, alias.length)
    if (minLength >= 5 && (h.includes(alias) || alias.includes(h))) {
      best = Math.max(best, 84)
    }

    const textSimilarity = bigramSimilarity(hc || h, ac || alias)
    if (textSimilarity >= 0.90) best = Math.max(best, 86)
    else if (textSimilarity >= 0.82) best = Math.max(best, 80)
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

  return score >= 80 && !ambiguous ? { header: best, score } : { header: '', score: 0 }
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

type AutoMapOptions = {
  allowGenericHeaders?: boolean
}

const assignHeaders = (
  headers: string[],
  profile: EntityProfile,
  options: AutoMapOptions = {},
  side: 'origin' | 'target' = 'origin',
) => {
  const claimed = new Map<string, Array<{ fieldId: string; score: number }>>()
  const guarded = new Map<string, string[]>()
  profile.ambiguousBareTokens.forEach(guard => {
    guard.fieldIds.forEach(fieldId => {
      const tokens = guarded.get(fieldId) ?? []
      tokens.push(guard.token)
      guarded.set(fieldId, tokens)
    })
  })

  profile.fields.forEach(field => {
    const exactAliases = side === 'origin' ? field.originExactAliases : field.targetExactAliases
    if (exactAliases !== undefined) {
      const exact = new Set(exactAliases.map(normalizeHeader))
      const header = headers.find(item => exact.has(normalizeHeader(item)))
      if (!header) return
      const list = claimed.get(header) ?? []
      list.push({ fieldId: field.id, score: 100 })
      claimed.set(header, list)
      return
    }

    const picked = pickBestHeader(headers, [field.label, ...field.aliases])
    if (!picked.header) return

    const tokens = guarded.get(field.id) ?? []
    if (tokens.some(token => isBareTokenHeader(picked.header, token))) return
    if (guarded.has(field.id) && hasAmbiguousDuplicate(headers, picked.header)) return
    if (
      options.allowGenericHeaders === false &&
      GENERIC_BARE_HEADERS.has(duplicateBase(picked.header))
    ) return

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

    const [winner, runnerUp] = ranked
    const uniqueExact = winner.score >= 95 && winner.score > runnerUp.score
    const clearGap = winner.score >= runnerUp.score + 10
    if (uniqueExact || clearGap) assigned.set(winner.fieldId, header)
  })

  return assigned
}

export interface HeaderSuggestion {
  header: string
  score: number
}

export const getHeaderSuggestions = (
  headers: string[],
  field: FieldDefinition,
  limit = 3,
): HeaderSuggestion[] => {
  return headers
    .filter(header => !header.startsWith('__primecheck_'))
    .map(header => ({
      header,
      score: scoreHeader(header, [field.label, ...field.aliases]),
    }))
    .filter(item => item.score >= 60)
    .sort((a, b) => b.score - a.score || a.header.localeCompare(b.header, 'pt-BR'))
    .slice(0, limit)
}

export const autoMap = (
  origin: Dataset,
  target: Dataset,
  profile: EntityProfile,
  options: AutoMapOptions = {},
): FieldMapping[] => {
  const originAssigned = assignHeaders(origin.headers, profile, options, 'origin')
  const targetAssigned = assignHeaders(target.headers, profile, options, 'target')

  // Regra padrão: quando a mesma coluna existe nos dois arquivos, espelhar o vínculo
  // entre origem e destino. O vínculo específico já encontrado continua tendo prioridade.
  profile.fields.forEach(field => {
    const originHeader = originAssigned.get(field.id) ?? ''
    const targetHeader = targetAssigned.get(field.id) ?? ''

    if (originHeader && !targetHeader && field.targetExactAliases?.length !== 0) {
      const normalizedOrigin = normalizeHeader(originHeader)
      const sameTargetHeader = target.headers.find(
        header => normalizeHeader(header) === normalizedOrigin,
      )
      if (sameTargetHeader) targetAssigned.set(field.id, sameTargetHeader)
    }

    if (targetHeader && !originHeader && field.originExactAliases?.length !== 0) {
      const normalizedTarget = normalizeHeader(targetHeader)
      const sameOriginHeader = origin.headers.find(
        header => normalizeHeader(header) === normalizedTarget,
      )
      if (sameOriginHeader) originAssigned.set(field.id, sameOriginHeader)
    }
  })

  return profile.fields.map(field => ({
    fieldId: field.id,
    originHeader: originAssigned.get(field.id) ?? '',
    targetHeader: targetAssigned.get(field.id) ?? '',
  }))
}

export const detectStatusHeader = (dataset: Dataset, statusAliases: string[]) =>
  pickBestHeader(dataset.headers, statusAliases).header

export const mappingCoverage = (mapping: FieldMapping[]) => {
  const both = mapping.filter(m => m.originHeader && m.targetHeader).length
  const originOnly = mapping.filter(m => m.originHeader && !m.targetHeader).length
  const targetOnly = mapping.filter(m => !m.originHeader && m.targetHeader).length
  const none = mapping.filter(m => !m.originHeader && !m.targetHeader).length

  return { both, originOnly, targetOnly, none, total: mapping.length }
}
