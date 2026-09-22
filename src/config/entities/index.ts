import type { EntityDetection, EntityProfile } from '../../types'
import { normalizeHeader } from '../../lib/normalizers'
import { scoreHeader } from '../../lib/mapping'
import { clientProfile } from './client'
import { supplierProfile } from './supplier'
import { productProfile } from './product'
import { WORKSPACE_ENTITY_PROFILES } from '../workspaceModules'

export const ENTITY_PROFILES: EntityProfile[] = [
  clientProfile,
  supplierProfile,
  productProfile,
]

const ALL_ENTITY_PROFILES: EntityProfile[] = [
  ...ENTITY_PROFILES,
  ...WORKSPACE_ENTITY_PROFILES,
]

export const getEntityProfile = (id: string): EntityProfile =>
  ALL_ENTITY_PROFILES.find(profile => profile.id === id) ?? clientProfile

const WEAK_HEADERS = new Set([
  'CODIGO', 'NOME', 'DESCRICAO', 'STATUS', 'SITUACAO', 'VALOR', 'TIPO',
  'GRUPO', 'EMPRESA', 'CONVENIO', 'DOCUMENTO', 'OBS', 'OBSERVACAO',
])

const distinctiveHit = (headers: string[], profile: EntityProfile) => {
  const normalizedHeaders = headers.map(normalizeHeader).filter(Boolean)
  let hits = 0

  profile.aliases.forEach(alias => {
    const token = normalizeHeader(alias)
    if (token.length < 6) return
    if (normalizedHeaders.some(header => header.includes(token))) hits += 6
  })

  profile.fields.forEach(field => {
    field.aliases.forEach(alias => {
      const token = normalizeHeader(alias)
      if (!token || WEAK_HEADERS.has(token) || token.length < 6) return
      if (normalizedHeaders.includes(token)) hits += 2
    })
  })

  return hits
}

export const scoreEntityProfile = (headers: string[], profile: EntityProfile) => {
  if (!headers.length) return 0

  const usable = headers.filter(header => header && !header.startsWith('__primecheck_'))
  let strong = 0

  usable.forEach(header => {
    if (WEAK_HEADERS.has(normalizeHeader(header))) return
    let best = 0
    profile.fields.forEach(field => {
      best = Math.max(best, scoreHeader(header, [field.label, ...field.aliases]))
    })
    if (best >= 80) strong += 1
  })

  const distinctive = distinctiveHit(usable, profile)
  const distinctiveScore = Math.min(70, distinctive * 7)
  const coverageScore = (strong / Math.max(1, usable.length)) * 40
  const weakOnlyPenalty = strong === 0 ? 20 : 0

  return Math.max(0, Math.min(99, Math.round(distinctiveScore + coverageScore - weakOnlyPenalty)))
}

export const detectEntityProfile = (
  headers: string[],
  fileNames: string[] = [],
): EntityDetection => {
  const scored = ENTITY_PROFILES.map(profile => {
    let confidence = scoreEntityProfile(headers, profile)
    const fileSignal = fileNames.some(name => {
      const normalized = normalizeHeader(name)
      return profile.aliases.some(alias => {
        const token = normalizeHeader(alias)
        return token.length >= 6 && normalized.includes(token)
      })
    })
    if (fileSignal) confidence = Math.min(99, confidence + 4)

    return { profileId: profile.id, label: profile.label, confidence }
  }).sort((a, b) => b.confidence - a.confidence)

  const best = scored[0]
  const second = scored[1]
  const gap = best.confidence - (second?.confidence ?? 0)
  const lowConfidence = best.confidence < 70 || gap < 12

  return {
    profileId: best.profileId,
    confidence: best.confidence,
    scores: scored,
    lowConfidence,
    reason: lowConfidence
      ? 'Tipo de dados não identificado com segurança.'
      : `${best.label} identificado pelas colunas importadas.`,
  }
}

export { clientProfile, supplierProfile, productProfile }
