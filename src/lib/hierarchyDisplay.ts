import { normalizeHeader } from './normalizers'
import type { ClientComparison } from '../types'

export type VisualHierarchyContext = {
  sectionNames: Record<string, string>
  groupNames: Record<string, string>
}

export type HierarchyVisual = {
  sectionCode: string
  sectionName: string
  groupCode: string
  groupName: string
  displayLabel: string
}

export const isGroupHierarchyProfile = (profileId: string) =>
  profileId === 'group' || profileId === 'workspace:groups'

export const isSubgroupHierarchyProfile = (profileId: string) =>
  profileId === 'subgroup' || profileId === 'workspace:subgroups'

const normalizeHierarchyCode = (value: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d+$/.test(text)) return text.replace(/^0+(?=\d)/, '')
  return text.toLocaleUpperCase('pt-BR')
}

const readHierarchyRowValue = (row: Record<string, unknown> | undefined, header: string) => {
  if (!row) return ''
  const expected = normalizeHeader(header)
  const key = Object.keys(row).find(candidate => normalizeHeader(candidate) === expected)
  return key ? String(row[key] ?? '').trim() : ''
}

export const buildHierarchyVisual = (
  client: ClientComparison,
  profileId: string,
  context?: VisualHierarchyContext,
): HierarchyVisual => {
  const keyParts = client.key.split('/').map(part => part.trim())
  const sectionField = client.fields.find(field => field.fieldId === 'codigoSecao')
  const groupField = client.fields.find(field => field.fieldId === 'codigoGrupo')

  const sectionCode = normalizeHierarchyCode(
    sectionField?.originValue || sectionField?.targetValue || keyParts[0],
  )
  const groupCode = normalizeHierarchyCode(
    groupField?.originValue || groupField?.targetValue || keyParts[1],
  )

  const directSectionName =
    readHierarchyRowValue(client.targetRow, 'DES_SECAO')
    || readHierarchyRowValue(client.originRow, 'DES_SECAO')
  const directGroupName =
    readHierarchyRowValue(client.targetRow, 'DES_GRUPO')
    || readHierarchyRowValue(client.originRow, 'DES_GRUPO')

  const sectionName =
    directSectionName
    || (sectionCode && context ? context.sectionNames[sectionCode] ?? '' : '')
  const groupName =
    directGroupName
    || (
      sectionCode && groupCode && context
        ? context.groupNames[sectionCode + '|' + groupCode] ?? ''
        : ''
    )

  const sectionLabel = sectionName || (sectionCode ? 'Seção ' + sectionCode : 'Seção')
  const groupLabel = groupName || (groupCode ? 'Grupo ' + groupCode : 'Grupo')
  const recordName = client.name || '—'

  const displayLabel = isGroupHierarchyProfile(profileId)
    ? sectionLabel + ' | ' + recordName
    : isSubgroupHierarchyProfile(profileId)
      ? sectionLabel + ' | ' + groupLabel + ' | ' + recordName
      : recordName

  return {
    sectionCode,
    sectionName,
    groupCode,
    groupName,
    displayLabel,
  }
}
