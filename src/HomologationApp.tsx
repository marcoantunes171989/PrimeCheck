import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import FileDropZone from './components/FileDropZone'
import MappingPanel from './components/MappingPanel'
import ClientDrawer from './components/ClientDrawer'
import { DuplicateCodeList, DuplicateGroupDetails } from './components/DuplicateRecordList'
import StatusBadge from './components/StatusBadge'
import IssuePrintReport, { type IssuePrintItem } from './components/IssuePrintReport'
import DataPrintReport from './components/DataPrintReport'
import TechnicalDiagnosisView from './components/TechnicalDiagnosisView'
import ManagementDashboardView from './components/ManagementDashboardView'
import { ENTITY_PROFILES, detectEntityProfile, getEntityProfile } from './config/entities'
import { buildDataset } from './lib/files'
import { autoMap, mappingCoverage } from './lib/mapping'
import { applyManualFieldAdjustment, compareDatasets, revertManualFieldAdjustment } from './lib/compare'
import { exportClientsCsv, exportReportExcel } from './lib/exporters'
import DuplicateAnalysisModal, { type DuplicateAnalysisRequest } from './components/DuplicateAnalysisModal'
import { buildRecordDisplayFields, findDuplicateGroup, isMonoDuplicateField, sideLabel } from './lib/duplicateDisplay'
import { normalizeHeader, validateCpfCnpj } from './lib/normalizers'
import { buildHierarchyVisual, isGroupHierarchyProfile, isSubgroupHierarchyProfile, type VisualHierarchyContext } from './lib/hierarchyDisplay'
import { formatReportDateTime } from './lib/reportFormatting'
import type { ClientComparison, ComparisonFieldResult, ComparisonReport, EntityProfile, FieldMapping, ImportedFile, Severity } from './types'

type Tab = 'overview' | 'dashboard' | 'diagnosis' | 'clients' | 'issues' | 'fields' | 'duplicates' | 'missing'
type EntityMode = 'auto' | string
type IssueDuplicateInfo = {
  count: number
  normalizedValue: string
}

type IssueOccurrence = {
  client: ClientComparison
  field: ComparisonFieldResult
  duplicate?: IssueDuplicateInfo
}

const number = (value: number) => value.toLocaleString('pt-BR')
const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(2).replace('.', ',')}%` : '—'
const plural = (profile: EntityProfile) => profile.label

type SortDirection = 'asc' | 'desc'
type SortState = { key: string; direction: SortDirection }

const sortValue = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return String(value ?? '').toLocaleUpperCase('pt-BR')
}

const compareSortValues = (left: unknown, right: unknown) => {
  const a = sortValue(left)
  const b = sortValue(right)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

const sortedBy = <T,>(
  items: T[],
  sort: SortState,
  getter: (item: T, key: string) => unknown,
) => [...items].sort((left, right) => {
  const direction = sort.direction === 'asc' ? 1 : -1
  return compareSortValues(getter(left, sort.key), getter(right, sort.key)) * direction
})

const nextSort = (current: SortState, key: string): SortState =>
  current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: 'asc' }

const toggleStringSet = (current: Set<string>, id: string) => {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: string
  sort: SortState
  onSort: (key: string) => void
}) {
  const active = sort.key === sortKey
  return (
    <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={'sort-header' + (active ? ' active' : '')}
        onClick={() => onSort(sortKey)}
        title={'Ordenar por ' + label}
      >
        <span>{label}</span>
        <i aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</i>
      </button>
    </th>
  )
}

type HomologationAppProps = {
  presetOriginFiles?: ImportedFile[]
  presetTargetFiles?: ImportedFile[]
  profileOverride?: EntityProfile
  embedded?: boolean
  originLabel?: string
  targetLabel?: string
  dashboardMode?: boolean
  visualHierarchy?: VisualHierarchyContext
  initialMapping?: FieldMapping[]
  onMappingChange?: (mapping: FieldMapping[]) => void
  restoreCompletedReport?: boolean
  onComparisonExecuted?: (mapping: FieldMapping[]) => void
}

const canonicalizeClientTargetFiles = (
  files: ImportedFile[],
  profile?: EntityProfile,
): ImportedFile[] => {
  if (!profile || (profile.id !== 'client' && profile.id !== 'workspace:clients')) return files

  return files.map(file => {
    const usedRawHeaders = new Set<string>()
    const canonicalPairs = profile.fields.flatMap(field => {
      const canonical = field.originExactAliases?.[0] ?? field.targetExactAliases?.[0]
      if (!canonical) return []

      // Aceita somente equivalências exatas e explicitamente conhecidas:
      // 1) o nome canônico usado na origem/checklist;
      // 2) aliases canônicos do destino;
      // 3) nomes físicos legados já validados no CSV do InterSolid.
      // Não usa aproximação/fuzzy nesta etapa.
      const sourceAliases = [
        canonical,
        ...(field.targetExactAliases ?? []),
        ...(field.targetSourceAliases ?? []),
      ]
      const sourceTokens = new Set(sourceAliases.map(normalizeHeader).filter(Boolean))

      const rawHeader = file.headers.find(header =>
        !usedRawHeaders.has(header)
        && sourceTokens.has(normalizeHeader(header)),
      )

      if (!rawHeader) return []
      usedRawHeaders.add(rawHeader)

      return [{ canonical, rawHeader }]
    })

    if (!canonicalPairs.length) return { ...file, headers: [] }

    const headers = [...new Set(canonicalPairs.map(pair => pair.canonical))]

    const rows = file.rows.map(row => {
      const next = { ...row }
      canonicalPairs.forEach(({ canonical, rawHeader }) => {
        next[canonical] = row[rawHeader]
      })
      return next
    })

    return { ...file, headers, rows }
  })
}

const mergePersistedMapping = (
  automatic: FieldMapping[],
  persisted: FieldMapping[],
  profile: EntityProfile,
  originHeaders: string[],
  targetHeaders: string[],
) => {
  const automaticByField = new Map(automatic.map(item => [item.fieldId, item]))
  const persistedByField = new Map(persisted.map(item => [item.fieldId, item]))

  return profile.fields.map(field => {
    const fallback = automaticByField.get(field.id)
    const saved = persistedByField.get(field.id)
    const savedOriginIsValid = Boolean(saved?.originHeader && originHeaders.includes(saved.originHeader))
    const savedTargetIsValid = Boolean(saved?.targetHeader && targetHeaders.includes(saved.targetHeader))

    return {
      fieldId: field.id,
      originHeader: savedOriginIsValid ? saved?.originHeader ?? '' : fallback?.originHeader ?? '',
      targetHeader: savedTargetIsValid ? saved?.targetHeader ?? '' : fallback?.targetHeader ?? '',
      originManual: savedOriginIsValid ? saved?.originManual : undefined,
      targetManual: savedTargetIsValid ? saved?.targetManual : undefined,
    }
  })
}

function App({
  presetOriginFiles,
  presetTargetFiles,
  profileOverride,
  embedded = false,
  originLabel = 'Origem',
  targetLabel = 'Destino',
  dashboardMode = false,
  visualHierarchy,
  initialMapping,
  onMappingChange,
  restoreCompletedReport = false,
  onComparisonExecuted,
}: HomologationAppProps = {}) {
  const [originFiles, setOriginFiles] = useState<ImportedFile[]>(presetOriginFiles ?? [])
  const [targetFiles, setTargetFiles] = useState<ImportedFile[]>(presetTargetFiles ?? [])
  const origin = useMemo(() => buildDataset(originFiles), [originFiles])
  const normalizedTargetFiles = useMemo(
    () => canonicalizeClientTargetFiles(targetFiles, profileOverride),
    [targetFiles, profileOverride],
  )
  const target = useMemo(() => buildDataset(normalizedTargetFiles), [normalizedTargetFiles])
  const [entityMode, setEntityMode] = useState<EntityMode>(profileOverride?.id ?? 'auto')
  const [mapping, setMapping] = useState<FieldMapping[]>([])
  const [report, setReport] = useState<ComparisonReport | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedClient, setSelectedClient] = useState<ClientComparison | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | Severity>('TODOS')
  const [issueFieldFilter, setIssueFieldFilter] = useState('TODOS')
  const [issueDuplicateFilter, setIssueDuplicateFilter] = useState<'TODOS' | 'DUPLICADOS' | 'NAO_DUPLICADOS'>('TODOS')
  const [clientColumnFilters, setClientColumnFilters] = useState({
    code: '',
    name: '',
    found: 'TODOS',
    status: 'TODOS',
    divergent: '',
    attention: '',
    document: '',
    validity: 'TODOS',
  })
  const [issueColumnFilters, setIssueColumnFilters] = useState({
    code: '',
    name: '',
    origin: '',
    target: '',
    reason: '',
  })
  const [duplicateFieldFocus, setDuplicateFieldFocus] = useState<string | undefined>()
  const [duplicateSearchFocus, setDuplicateSearchFocus] = useState('')
  const [duplicateSideFocus, setDuplicateSideFocus] = useState<'TODOS' | 'ORIGEM' | 'DESTINO'>('TODOS')
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateAnalysisRequest | null>(null)
  const [clientSort, setClientSort] = useState<SortState>({ key: 'code', direction: 'asc' })
  const [issueSort, setIssueSort] = useState<SortState>({ key: 'field', direction: 'asc' })
  const [selectedClientKeys, setSelectedClientKeys] = useState<Set<string>>(new Set())
  const [reviewedClientKeys, setReviewedClientKeys] = useState<Set<string>>(new Set())
  const [clientPrintSelected, setClientPrintSelected] = useState(false)
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<Set<string>>(new Set())
  const [reviewedIssueKeys, setReviewedIssueKeys] = useState<Set<string>>(new Set())
  const [issuePrintItems, setIssuePrintItems] = useState<IssuePrintItem[]>([])
  const [focusedFieldId, setFocusedFieldId] = useState<string | undefined>()
  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const restoredComparisonKey = useRef('')
  const suppressAutoRestore = useRef(false)

  const presetOriginKey = presetOriginFiles?.map(file => file.id).join('|') ?? ''
  const presetTargetKey = presetTargetFiles?.map(file => file.id).join('|') ?? ''

  useEffect(() => {
    if (!presetOriginFiles) return
    restoredComparisonKey.current = ''
    suppressAutoRestore.current = false
    setOriginFiles(presetOriginFiles)
    setReport(null)
    setSelectedClient(null)
  }, [presetOriginKey])

  useEffect(() => {
    if (!presetTargetFiles) return
    restoredComparisonKey.current = ''
    suppressAutoRestore.current = false
    setTargetFiles(presetTargetFiles)
    setReport(null)
    setSelectedClient(null)
  }, [presetTargetKey])

  useEffect(() => {
    if (profileOverride) setEntityMode(profileOverride.id)
  }, [profileOverride?.id])

  useEffect(() => {
    if (dashboardMode) {
      setActiveTab('dashboard')
    } else {
      setActiveTab(current => current === 'dashboard' ? 'overview' : current)
    }
  }, [dashboardMode])

  const detectionHeaders = useMemo(
    () => [...new Set([...origin.headers, ...target.headers])],
    [origin.headers, target.headers],
  )
  const detectionNames = useMemo(
    () => [...origin.files, ...target.files].map(file => file.name),
    [origin.files, target.files],
  )
  const detection = useMemo(
    () => detectEntityProfile(detectionHeaders, detectionNames),
    [detectionHeaders, detectionNames],
  )
  const profile = useMemo(
    () => profileOverride ?? getEntityProfile(entityMode === 'auto' ? detection.profileId : entityMode),
    [detection.profileId, entityMode, profileOverride],
  )
  const conservativeMapping = !profileOverride && entityMode === 'auto' && detection.lowConfidence

  const commitMapping = (next: FieldMapping[]) => {
    setMapping(next)
    onMappingChange?.(next)
  }

  useEffect(() => {
    if (origin.headers.length && target.headers.length) {
      const automatic = autoMap(origin, target, profile, { allowGenericHeaders: !conservativeMapping })
      const next = initialMapping?.length
        ? mergePersistedMapping(automatic, initialMapping, profile, origin.headers, target.headers)
        : automatic
      commitMapping(next)
      setReport(null)
    } else {
      setMapping([])
      setReport(null)
    }
  }, [
    origin.headers.join('|'),
    target.headers.join('|'),
    profile.id,
    conservativeMapping,
    initialMapping,
  ])

  useEffect(() => setPage(1), [search, statusFilter, issueFieldFilter, activeTab, pageSize])

  useEffect(() => {
    const handleAfterPrint = () => setIssuePrintItems([])
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  useEffect(() => {
    setSelectedClientKeys(new Set())
    setReviewedClientKeys(new Set())
    setSelectedIssueKeys(new Set())
    setReviewedIssueKeys(new Set())
  }, [report?.generatedAt])

  const coverage = useMemo(() => mappingCoverage(mapping), [mapping])
  const keyFields = profile.fields.filter(field => field.requiredForMatch)
  const keyMappings = keyFields.map(field => mapping.find(item => item.fieldId === field.id))
  const ready = origin.rows.length > 0
    && target.rows.length > 0
    && keyFields.length > 0
    && keyMappings.every(item => Boolean(item?.originHeader && item?.targetHeader))
  const keyLabel = keyFields.map(field => field.label).join(' + ') || 'chave do registro'
  const restoreComparisonKey = [
    profile.id,
    origin.files.map(file => `${file.id}:${file.rows.length}`).join(','),
    target.files.map(file => `${file.id}:${file.rows.length}`).join(','),
    mapping.map(item => [
      item.fieldId,
      item.originHeader,
      item.targetHeader,
      item.originManual === true ? '1' : '0',
      item.targetManual === true ? '1' : '0',
    ].join(':')).join('|'),
  ].join('||')
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'diagnosis', label: 'Diagnóstico rápido' },
    { id: 'clients', label: plural(profile) },
    { id: 'issues', label: 'Divergências' },
    { id: 'fields', label: 'Por campo' },
    { id: 'duplicates', label: 'Duplicidades' },
    { id: 'missing', label: 'Não importados' },
  ]

  const remap = () => {
    const automatic = autoMap(origin, target, profile, { allowGenericHeaders: !conservativeMapping })
    const currentByField = new Map(mapping.map(item => [item.fieldId, item]))
    const next = automatic.map(item => {
      const current = currentByField.get(item.fieldId)
      const keepOrigin = Boolean(
        current?.originManual
        && current.originHeader
        && origin.headers.includes(current.originHeader),
      )
      const keepTarget = Boolean(
        current?.targetManual
        && current.targetHeader
        && target.headers.includes(current.targetHeader),
      )

      return {
        ...item,
        originHeader: keepOrigin ? current?.originHeader ?? '' : item.originHeader,
        targetHeader: keepTarget ? current?.targetHeader ?? '' : item.targetHeader,
        originManual: keepOrigin ? true : undefined,
        targetManual: keepTarget ? true : undefined,
      }
    })

    commitMapping(next)
    setReport(null)
  }

  const runComparison = () => {
    setBusy(true)
    setError('')
    window.setTimeout(() => {
      try {
        const next = compareDatasets(origin, target, mapping, profile)
        setReport(next)
        suppressAutoRestore.current = false
        onComparisonExecuted?.(mapping)
        setActiveTab(dashboardMode ? 'dashboard' : 'overview')
        setIssueFieldFilter('TODOS')
        setStatusFilter('TODOS')
        setIssueDuplicateFilter('TODOS')
        setSearch('')
        setFocusedFieldId(undefined)
        setSelectedOccurrenceKey(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível executar a análise.')
      } finally {
        setBusy(false)
      }
    }, 40)
  }

  useEffect(() => {
    if (!restoreCompletedReport || suppressAutoRestore.current || !ready || report || busy) return
    if (!restoreComparisonKey || restoredComparisonKey.current === restoreComparisonKey) return

    restoredComparisonKey.current = restoreComparisonKey
    runComparison()
  }, [restoreCompletedReport, ready, report, busy, restoreComparisonKey])

  const handleManualAdjustment = (
    clientKey: string,
    fieldId: string,
    input: Parameters<typeof applyManualFieldAdjustment>[3],
  ) => {
    if (!report) return

    const next = applyManualFieldAdjustment(report, clientKey, fieldId, input)
    setReport(next)
    setSelectedClient(next.clients.find(client => client.key === clientKey) ?? null)
  }

  const handleRevertManualAdjustment = (clientKey: string, fieldId: string) => {
    if (!report) return

    const next = revertManualFieldAdjustment(report, clientKey, fieldId)
    setReport(next)
    setSelectedClient(next.clients.find(client => client.key === clientKey) ?? null)
  }

  const resultProfile = report ? getEntityProfile(report.profileId) : profile
  const showDocument = resultProfile.showDocumentValidity === true

  const showGroupHierarchy = isGroupHierarchyProfile(resultProfile.id)
  const showSubgroupHierarchy = isSubgroupHierarchyProfile(resultProfile.id)

  const hierarchyForClient = (client: ClientComparison) =>
    buildHierarchyVisual(client, resultProfile.id, visualHierarchy)

  const hierarchyDisplayForClient = (client: ClientComparison) =>
    hierarchyForClient(client).displayLabel

  const filteredClients = useMemo(() => {
    if (!report) return []
    const term = search.trim().toLocaleUpperCase('pt-BR')
    const contains = (value: unknown, filter: string) =>
      !filter.trim() || String(value ?? '').toLocaleUpperCase('pt-BR').includes(filter.trim().toLocaleUpperCase('pt-BR'))

    return report.clients.filter(client => {
      if (statusFilter !== 'TODOS' && client.status !== statusFilter) return false
      if (clientColumnFilters.status !== 'TODOS' && client.status !== clientColumnFilters.status) return false
      if (clientColumnFilters.found === 'SIM' && !client.found) return false
      if (clientColumnFilters.found === 'NAO' && client.found) return false
      if (!contains(client.key, clientColumnFilters.code)) return false
      if (!contains(
        showGroupHierarchy || showSubgroupHierarchy
          ? hierarchyDisplayForClient(client)
          : client.name,
        clientColumnFilters.name,
      )) return false

      if (!contains(client.divergentCount, clientColumnFilters.divergent)) return false
      if (!contains(client.attentionCount, clientColumnFilters.attention)) return false

      const document = client.fields.find(field => field.fieldId === 'cpfCnpj')?.originValue ?? ''
      if (!contains(document, clientColumnFilters.document)) return false
      const validity = validateCpfCnpj(document).status
      if (clientColumnFilters.validity !== 'TODOS' && validity !== clientColumnFilters.validity) return false

      if (!term) return true
      const fieldHit = client.fields.some(field =>
        `${field.fieldLabel} ${field.group} ${field.originValue} ${field.targetValue} ${field.reason}`
          .toLocaleUpperCase('pt-BR')
          .includes(term),
      )
      const rawHit = [
        ...Object.values(client.originRow),
        ...Object.values(client.targetRow ?? {}),
      ].some(value => String(value ?? '').toLocaleUpperCase('pt-BR').includes(term))
      const hierarchy = hierarchyForClient(client)
      const hierarchyHit = [
        hierarchy.sectionName,
        hierarchy.groupName,
      ].some(value => value.toLocaleUpperCase('pt-BR').includes(term))
      return client.key.toLocaleUpperCase('pt-BR').includes(term)
        || client.name.toLocaleUpperCase('pt-BR').includes(term)
        || fieldHit
        || rawHit
        || hierarchyHit
    })
  }, [report, search, statusFilter, clientColumnFilters, visualHierarchy, resultProfile.id, showGroupHierarchy, showSubgroupHierarchy])

  const originDuplicateLookup = useMemo(() => {
    const lookup = new Map<string, IssueDuplicateInfo>()
    if (!report) return lookup

    for (const duplicate of report.duplicates) {
      if (duplicate.side !== 'ORIGEM') continue
      for (const record of duplicate.records) {
        if (!record.key) continue
        lookup.set(
          `${record.key}::${duplicate.fieldId}`,
          { count: duplicate.count, normalizedValue: duplicate.normalizedValue },
        )
      }
    }
    return lookup
  }, [report])

  const duplicateAnalysisGroup = useMemo(() => {
    if (!report || !duplicateAnalysis) return null
    return findDuplicateGroup(
      report.duplicates,
      duplicateAnalysis.fieldId,
      duplicateAnalysis.normalizedValue,
      duplicateAnalysis.side,
    ) ?? null
  }, [report, duplicateAnalysis])

  const issueScope = useMemo<IssueOccurrence[]>(() => {
    if (!report) return []
    const restrictField = issueFieldFilter !== 'TODOS'

    return report.clients.flatMap(client => {
      if (restrictField && !client.found) return []
      return client.fields
        .filter(field => field.status === 'DIVERGENTE' || field.status === 'ATENÇÃO')
        .map(field => {
          const duplicate = originDuplicateLookup.get(`${client.key}::${field.fieldId}`)
          return { client, field, duplicate }
        })
    }).filter(item => {
      if (restrictField && item.field.fieldId !== issueFieldFilter) return false
      if (statusFilter !== 'TODOS' && item.field.status !== statusFilter) return false
      if (issueDuplicateFilter === 'DUPLICADOS' && !item.duplicate) return false
      if (issueDuplicateFilter === 'NAO_DUPLICADOS' && item.duplicate) return false
      return true
    })
  }, [report, issueFieldFilter, statusFilter, issueDuplicateFilter, originDuplicateLookup])

  const issues = useMemo(() => {
    const term = search.trim().toLocaleUpperCase('pt-BR')
    const contains = (value: unknown, filter: string) =>
      !filter.trim() || String(value ?? '').toLocaleUpperCase('pt-BR').includes(filter.trim().toLocaleUpperCase('pt-BR'))

    return issueScope.filter(item => {
      if (!contains(item.client.key, issueColumnFilters.code)) return false
      if (!contains(item.client.name, issueColumnFilters.name)) return false
      if (!contains(item.field.originValue, issueColumnFilters.origin)) return false
      if (!contains(item.field.targetValue, issueColumnFilters.target)) return false
      if (!contains(item.field.reason, issueColumnFilters.reason)) return false

      if (!term) return true
      const duplicateText = item.duplicate
        ? ` DUPLICADO ${item.duplicate.count} ${item.duplicate.normalizedValue}`
        : ' NAO DUPLICADO'
      const text = `${item.client.key} ${item.client.name} ${item.field.fieldLabel} ${item.field.group} ${item.field.originValue} ${item.field.targetValue} ${item.field.status} ${item.field.reason}${duplicateText}`
        .toLocaleUpperCase('pt-BR')
      return text.includes(term)
    })
  }, [issueScope, search, issueColumnFilters])

  const issueFieldOptions = useMemo(() => {
    if (!report) return []
    return report.fieldSummary
      .filter(field => field.divergent > 0 || field.attention > 0)
      .map(field => ({
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        count: field.divergent + field.attention,
      }))
      .sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel, 'pt-BR', { sensitivity: 'base' }))
  }, [report])

  const sortedClients = useMemo(() => sortedBy(filteredClients, clientSort, (client, key) => {
    if (key === 'code') return client.key
    if (key === 'name') return showGroupHierarchy || showSubgroupHierarchy
      ? hierarchyDisplayForClient(client)
      : client.name
    if (key === 'found') return client.found
    if (key === 'status') return client.status
    if (key === 'divergent') return client.divergentCount
    if (key === 'attention') return client.attentionCount
    if (key === 'document') return client.fields.find(field => field.fieldId === 'cpfCnpj')?.originValue ?? ''
    if (key === 'validity') return validateCpfCnpj(client.fields.find(field => field.fieldId === 'cpfCnpj')?.originValue ?? '').status
    return ''
  }), [filteredClients, clientSort, showGroupHierarchy, showSubgroupHierarchy, visualHierarchy, resultProfile.id])

  const sortedIssues = useMemo(() => sortedBy(issues, issueSort, (item, key) => {
    if (key === 'code') return item.client.key
    if (key === 'name') return item.client.name
    if (key === 'field') return item.field.fieldLabel
    if (key === 'origin') return item.field.originValue
    if (key === 'target') return item.field.targetValue
    if (key === 'status') return item.field.status
    if (key === 'reason') return item.field.reason
    return ''
  }), [issues, issueSort])

  const pageSlice = <T,>(items: T[]) => items.slice((page - 1) * pageSize, page * pageSize)
  const pageCount = (items: unknown[]) => Math.max(1, Math.ceil(items.length / pageSize))
  const conformityProgress = report?.summary.validTests
    ? (report.summary.conformTests / report.summary.validTests) * 100
    : 0
  const reviewProgress = Math.max(0, 100 - conformityProgress)

  const clearAll = () => {
    setOriginFiles([])
    setTargetFiles([])
    commitMapping([])
    setReport(null)
    setSelectedClient(null)
    setSearch('')
    setStatusFilter('TODOS')
    setIssueFieldFilter('TODOS')
    setIssueDuplicateFilter('TODOS')
    setFocusedFieldId(undefined)
    setSelectedOccurrenceKey(null)
    setEntityMode('auto')
  }

  const openFieldAnalysis = (fieldId: string, status: 'TODOS' | 'DIVERGENTE' | 'ATENÇÃO') => {
    setIssueFieldFilter(fieldId)
    setStatusFilter(status)
    setIssueDuplicateFilter('TODOS')
    setSearch('')
    setPage(1)
    setActiveTab('issues')
  }

  const backToFields = () => {
    setActiveTab('fields')
    setIssueFieldFilter('TODOS')
    setStatusFilter('TODOS')
    setIssueDuplicateFilter('TODOS')
    setSearch('')
    setPage(1)
  }

  const clearIssueFieldFilter = () => {
    setIssueFieldFilter('TODOS')
    setPage(1)
  }

  const openDuplicates = (
    fieldId?: string,
    normalizedValue = '',
    side: 'TODOS' | 'ORIGEM' | 'DESTINO' = 'TODOS',
  ) => {
    setDuplicateFieldFocus(fieldId)
    setDuplicateSearchFocus(normalizedValue)
    setDuplicateSideFocus(side)
    setActiveTab('duplicates')
    setPage(1)
  }

  const openDuplicateAnalysis = (
    fieldId: string,
    fieldLabel: string,
    normalizedValue: string,
    side: DuplicateAnalysisRequest['side'],
  ) => {
    setDuplicateAnalysis({ fieldId, fieldLabel, normalizedValue, side })
  }

  const openRecord = (client: ClientComparison, fieldId?: string, occurrenceKey?: string) => {
    setSelectedClient(client)
    setFocusedFieldId(fieldId ?? (issueFieldFilter !== 'TODOS' ? issueFieldFilter : undefined))
    setSelectedOccurrenceKey(occurrenceKey ?? null)
  }

  const occurrenceKeyOf = (clientKey: string, fieldId: string) => `${clientKey}::${fieldId}`
  const occurrenceIndex = selectedOccurrenceKey
    ? sortedIssues.findIndex(item => occurrenceKeyOf(item.client.key, item.field.fieldId) === selectedOccurrenceKey)
    : -1
  const goToOccurrence = (index: number) => {
    const item = sortedIssues[index]
    if (!item) return
    setPage(Math.floor(index / pageSize) + 1)
    openRecord(item.client, item.field.fieldId, occurrenceKeyOf(item.client.key, item.field.fieldId))
  }
  const fieldAnalysis = (() => {
    if (issueFieldFilter === 'TODOS' || !report) return null
    const summary = report.fieldSummary.find(field => field.fieldId === issueFieldFilter)
    if (summary) return { fieldId: summary.fieldId, fieldLabel: summary.fieldLabel, group: summary.group }
    const definition = resultProfile.fields.find(field => field.id === issueFieldFilter)
    return {
      fieldId: issueFieldFilter,
      fieldLabel: definition?.label ?? issueFieldFilter,
      group: definition?.group ?? '',
    }
  })()
  const analysisStatusLabel = statusFilter === 'DIVERGENTE'
    ? 'Divergente'
    : statusFilter === 'ATENÇÃO'
      ? 'Atenção'
      : 'Divergências + Atenções'
  const analysisCountLabel = statusFilter === 'DIVERGENTE'
    ? `${number(issueScope.length)} ${issueScope.length === 1 ? 'divergência encontrada' : 'divergências encontradas'}`
    : statusFilter === 'ATENÇÃO'
      ? `${number(issueScope.length)} ${issueScope.length === 1 ? 'atenção encontrada' : 'atenções encontradas'}`
      : `${number(issueScope.length)} ${issueScope.length === 1 ? 'ocorrência para revisão' : 'ocorrências para revisão'}`
  const drawerFocusedFieldId = focusedFieldId ?? (issueFieldFilter !== 'TODOS' ? issueFieldFilter : undefined)
  const occurrenceNav = selectedClient && occurrenceIndex >= 0 && issues.length > 0
    ? {
        current: occurrenceIndex,
        total: sortedIssues.length,
        onPrev: () => goToOccurrence(occurrenceIndex - 1),
        onNext: () => goToOccurrence(occurrenceIndex + 1),
      }
    : undefined

  const currentClientPage = pageSlice(sortedClients)
  const currentClientKeys = currentClientPage.map(client => client.key)
  const selectedClients = sortedClients.filter(client => selectedClientKeys.has(client.key))
  const allCurrentClientsSelected = currentClientKeys.length > 0
    && currentClientKeys.every(key => selectedClientKeys.has(key))

  const toggleCurrentClientPage = () => {
    setSelectedClientKeys(current => {
      const next = new Set(current)
      if (allCurrentClientsSelected) currentClientKeys.forEach(key => next.delete(key))
      else currentClientKeys.forEach(key => next.add(key))
      return next
    })
  }

  const requestClientPrint = (onlySelected: boolean) => {
    setClientPrintSelected(onlySelected)
    window.setTimeout(() => window.print(), 80)
  }

  const currentIssuePage = pageSlice(sortedIssues)
  const currentIssueKeys = currentIssuePage.map(item => occurrenceKeyOf(item.client.key, item.field.fieldId))
  const selectedIssues = sortedIssues.filter(item =>
    selectedIssueKeys.has(occurrenceKeyOf(item.client.key, item.field.fieldId)),
  )
  const allCurrentIssuesSelected = currentIssueKeys.length > 0
    && currentIssueKeys.every(key => selectedIssueKeys.has(key))

  const toggleIssueSelection = (key: string) => {
    setSelectedIssueKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleCurrentIssuePage = () => {
    setSelectedIssueKeys(current => {
      const next = new Set(current)
      if (allCurrentIssuesSelected) currentIssueKeys.forEach(key => next.delete(key))
      else currentIssueKeys.forEach(key => next.add(key))
      return next
    })
  }

  const requestIssuePrint = (items: IssueOccurrence[]) => {
    if (!items.length) return
    setIssuePrintItems(items)
    window.setTimeout(() => window.print(), 80)
  }

  const issuePrintFilterDescription = [
    issueFieldFilter === 'TODOS'
      ? 'Todos os campos'
      : resultProfile.fields.find(field => field.id === issueFieldFilter)?.label || issueFieldFilter,
    statusFilter === 'TODOS' ? 'Divergências e atenções' : statusFilter,
    issueDuplicateFilter === 'DUPLICADOS' ? 'Somente duplicados' : issueDuplicateFilter === 'NAO_DUPLICADOS' ? 'Sem duplicidade' : '',
    search.trim() ? 'Pesquisa: ' + search.trim() : '',
  ].filter(Boolean).join(' · ')

  const hasFiles = origin.headers.length > 0 || target.headers.length > 0

  const homologationModeClass = report
    ? 'homologation-results-mode'
    : hasFiles
      ? 'homologation-setup-mode has-files'
      : 'homologation-setup-mode empty-files'

  return (
    <div className={'app-shell homologation-shell ' + homologationModeClass + (embedded ? ' embedded-homologation' : '')}>
      {!embedded && <header className="topbar">
        <div className="module-topbar-title">
          <strong>Homologação</strong>
          <span>Importação, vínculo e comparação de dados</span>
        </div>
        <div className="topbar-actions">
          <div className="privacy-pill"><span>●</span> Processamento local no navegador</div>
          {(originFiles.length > 0 || targetFiles.length > 0) && <button className="button ghost" onClick={clearAll}>Limpar análise</button>}
        </div>
      </header>}

      <main className={'main-content' + (embedded ? ' embedded-main-content' : '')}>
        {!embedded && <section className="hero">
          <div>
            <span className="eyebrow">PRIMECHECK DATA VALIDATION</span>
            <h1>Compare. Valide. Homologue.</h1>
            <p>Importe os arquivos de origem e destino. O PrimeCheck identifica o tipo de dado pelas colunas, cruza os registros no próprio navegador e evidencia o que exige revisão.</p>
          </div>
          <div className="flow-mini" aria-label="Fluxo da homologação">
            <span className={originFiles.length || targetFiles.length ? 'done' : 'active'}>1. Importar</span>
            <i>→</i>
            <span className={mapping.length ? 'done' : ''}>2. Mapear</span>
            <i>→</i>
            <span className={report ? 'done' : ''}>3. Validar</span>
          </div>
        </section>}

        {!report && (
          <>
            {!embedded && <div className="privacy-banner">
              <strong>Seus dados não são enviados para banco de dados.</strong>
              <span>Os arquivos ficam somente na memória da aba enquanto a análise estiver aberta.</span>
            </div>}

            {!embedded && <section className="entity-type-card">
              <div className="entity-type-copy">
                <span className="eyebrow">TIPO DE DADOS</span>
                <h2>O que esses arquivos representam?</h2>
                <p>A detecção usa estrutura, nomes de colunas e aliases — não o nome do arquivo. Você pode confirmar ou alterar o perfil a qualquer momento.</p>
              </div>
              <label className="entity-type-select">
                <span>Perfil de homologação</span>
                <select
                  value={entityMode}
                  onChange={event => setEntityMode(event.target.value)}
                  aria-label="Tipo de dados"
                >
                  <option value="auto">Detectar automaticamente</option>
                  {ENTITY_PROFILES.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              {hasFiles && (
                <div className={`entity-detection ${detection.lowConfidence && entityMode === 'auto' ? 'low' : 'ok'}`}>
                  {entityMode === 'auto' && detection.lowConfidence ? (
                    <>
                      <strong>Tipo de dados não identificado com segurança.</strong>
                      <span>Selecione Clientes, Fornecedores ou Produtos para continuar com mais precisão.</span>
                    </>
                  ) : (
                    <>
                      <strong>Tipo identificado: {profile.label}</strong>
                      <span>Confiança: {detection.confidence}%</span>
                    </>
                  )}
                  {entityMode !== 'auto' && (
                    <small>Seleção manual. A detecção automática sugeriu {getEntityProfile(detection.profileId).label} ({detection.confidence}%).</small>
                  )}
                </div>
              )}
            </section>}

            {!embedded && <section className="import-grid">
              <FileDropZone
                title="Arquivos de origem"
                subtitle="Sistema legado, exportação original ou base de referência."
                files={originFiles}
                onChange={setOriginFiles}
                tone="origin"
              />
              <FileDropZone
                title="Arquivos de destino"
                subtitle="Sistema convertido, ERP de destino ou base homologada."
                files={targetFiles}
                onChange={setTargetFiles}
                tone="target"
              />
            </section>}

            {embedded && (
              <section className="embedded-comparison-summary">
                <div>
                  <span>Perfil</span>
                  <strong>{profile.label}</strong>
                  <small>Comparação preserva as mesmas regras de mapeamento, divergências, duplicidades e validação por campo.</small>
                </div>
                <div>
                  <span>{originLabel}</span>
                  <strong>{number(origin.rows.length)} registros</strong>
                  <small>{origin.headers.length} colunas identificadas</small>
                </div>
                <div>
                  <span>{targetLabel}</span>
                  <strong>{number(target.rows.length)} registros</strong>
                  <small>{target.headers.length} colunas identificadas</small>
                </div>
                <div>
                  <span>Chave de comparação</span>
                  <strong>{keyLabel}</strong>
                  <small>{coverage.both} campos já vinculados nos dois lados</small>
                </div>
              </section>
            )}

            {!embedded && (origin.rows.length > 0 || target.rows.length > 0) && (
              <section className="dataset-summary">
                <div><span>Origem</span><strong>{number(origin.rows.length)}</strong><small>{origin.headers.length} colunas identificadas</small></div>
                <div><span>Destino</span><strong>{number(target.rows.length)}</strong><small>{target.headers.length} colunas identificadas</small></div>
                <div><span>Mapeáveis</span><strong>{coverage.both}</strong><small>de {profile.fields.length} campos do perfil {profile.label}</small></div>
              </section>
            )}

            {origin.headers.length > 0 && target.headers.length > 0 && (
              <MappingPanel
                profile={profile}
                mapping={mapping}
                originHeaders={origin.headers}
                targetHeaders={target.headers}
                onChange={commitMapping}
                onAutoMap={remap}
              />
            )}

            {error && <div className="global-error">{error}</div>}

            <div className="run-bar">
              <div>
                <strong>{ready ? `Pronto para homologar ${profile.label.toLowerCase()}.` : `Confirme o vínculo da chave ${keyLabel} nos dois arquivos.`}</strong>
                <span>{coverage.both} campos serão comparados automaticamente. Origem e destino não precisam ter a mesma quantidade de colunas.</span>
              </div>
              <button className="button primary large" disabled={!ready || busy} onClick={runComparison}>
                {busy ? 'Processando…' : 'Executar homologação'}
              </button>
            </div>
          </>
        )}

        {report && (
          <section className="results">
            <div className="results-head">
              <div>
                <span className="eyebrow">RESULTADO · {resultProfile.label.toUpperCase()}</span>
                <h2>Análise concluída</h2>
                <p>{number(report.summary.validTests)} comparações validáveis · {pct(report.summary.conformTests, report.summary.validTests)} de conformidade por teste.</p>
              </div>
              <div className="result-actions">
                <button className="button ghost" onClick={() => {
                  suppressAutoRestore.current = true
                  setReport(null)
                  setActiveTab('overview')
                  setIssueFieldFilter('TODOS')
                  setStatusFilter('TODOS')
                  setSearch('')
                  setFocusedFieldId(undefined)
                  setSelectedOccurrenceKey(null)
                }}>Ajustar mapeamento</button>
                <button className="button secondary" onClick={() => window.print()}>Imprimir / PDF</button>
                <button className="button primary" onClick={() => exportReportExcel(report)}>Exportar Excel</button>
              </div>
            </div>

            <div className="kpi-grid">
              <Kpi label="Registros origem" value={report.summary.originTotal} note={`${number(report.summary.foundTotal)} encontrados`} />
              <Kpi label="Registros destino" value={report.summary.targetTotal} note={`${number(report.summary.targetOnlyClients)} somente no destino`} />
              <Kpi label="Conformes" value={report.summary.conformClients} note="sem divergência ou atenção" tone="ok" />
              <Kpi label="Divergentes" value={report.summary.divergentClients} note="erro de conversão" tone="error" />
              <Kpi label="Atenções" value={report.summary.attentionClients} note="revisão recomendada" tone="warning" />
              <Kpi label="Não importados" value={report.summary.notImportedClients} note="ausentes no destino" />
            </div>

            <div className="validation-progress" aria-label="Progresso da homologação">
              <div className="validation-progress-copy">
                <div>
                  <span>Conformidade dos testes</span>
                  <strong>{conformityProgress.toFixed(2).replace('.', ',')}%</strong>
                </div>
                <div className="validation-progress-review">
                  <span>Divergências + atenções</span>
                  <strong>{reviewProgress.toFixed(2).replace('.', ',')}%</strong>
                </div>
              </div>
              <div className="validation-progress-track">
                <i className="validation-progress-ok" style={{ width: `${conformityProgress}%` }} />
                <i className="validation-progress-pending" style={{ width: `${reviewProgress}%` }} />
              </div>
            </div>

            <nav className="tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => {
                    if (tab.id === 'duplicates') {
                      setDuplicateFieldFocus(undefined)
                      setDuplicateSearchFocus('')
                      setDuplicateSideFocus('TODOS')
                    }
                    setActiveTab(tab.id)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab !== 'overview' && activeTab !== 'dashboard' && activeTab !== 'diagnosis' && activeTab !== 'fields' && activeTab !== 'duplicates' && activeTab !== 'missing' && (
              <div className={`filters${activeTab === 'issues' ? ' filters-issues' : ''}`}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Pesquisar código, ${resultProfile.recordLabel.toLowerCase()} ou qualquer valor…`} />
                {activeTab === 'issues' && (
                  <select
                    value={issueFieldFilter}
                    onChange={e => setIssueFieldFilter(e.target.value)}
                    aria-label="Filtrar por campo"
                  >
                    <option value="TODOS">Todos os tipos de divergência</option>
                    {issueFieldOptions.map(field => (
                      <option key={field.fieldId} value={field.fieldId}>
                        {field.fieldLabel} ({number(field.count)})
                      </option>
                    ))}
                  </select>
                )}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filtrar por status">
                  <option value="TODOS">Todos os resultados</option>
                  <option value="DIVERGENTE">Divergente</option>
                  <option value="ATENÇÃO">Atenção</option>
                  <option value="CONFORME">Conforme</option>
                  <option value="NÃO IMPORTADO">Não importado</option>
                </select>
                {activeTab === 'issues' && (
                  <select
                    value={issueDuplicateFilter}
                    onChange={e => setIssueDuplicateFilter(e.target.value as typeof issueDuplicateFilter)}
                    aria-label="Filtrar por duplicidade na origem"
                  >
                    <option value="TODOS">Todos · duplicidade</option>
                    <option value="DUPLICADOS">Somente duplicados</option>
                    <option value="NAO_DUPLICADOS">Sem duplicidade</option>
                  </select>
                )}
                <span className="page-size-fixed">20 por página</span>
              </div>
            )}

            {activeTab === 'overview' && <Overview report={report} profile={resultProfile} onOpenClient={client => openRecord(client)} />}
            {activeTab === 'dashboard' && (
              <ManagementDashboardView
                report={report}
                profile={resultProfile}
                onAnalyzeField={fieldId => openFieldAnalysis(fieldId, 'TODOS')}
              />
            )}
            {activeTab === 'diagnosis' && (
              <TechnicalDiagnosisView
                report={report}
                profile={resultProfile}
                onOpenIssue={(client, field) => openRecord(client, field.fieldId)}
                onOpenDuplicates={fieldId => openDuplicates(fieldId)}
              />
            )}
            {activeTab === 'clients' && (
              <>
                <div className="panel">
                  <div className="section-head compact">
                    <div>
                      <h3>{resultProfile.label}</h3>
                      <p>{number(filteredClients.length)} registros no filtro atual · paginação padrão de 20.</p>
                    </div>
                    <div className="section-head-actions">
                      <span className="selection-summary">{number(selectedClients.length)} selecionados</span>
                      <button
                        type="button"
                        className="button ghost compact-button"
                        onClick={() => {
                          setClientColumnFilters({
                            code: '',
                            name: '',
                            found: 'TODOS',
                            status: 'TODOS',
                            divergent: '',
                            attention: '',
                            document: '',
                            validity: 'TODOS',
                          })
                        }}
                      >
                        Limpar filtros
                      </button>
                      <button
                        type="button"
                        className="button ghost compact-button"
                        disabled={!currentClientPage.length}
                        onClick={toggleCurrentClientPage}
                      >
                        {allCurrentClientsSelected ? 'Desmarcar página' : 'Selecionar página'}
                      </button>
                      <button
                        type="button"
                        className="button secondary compact-button"
                        disabled={!selectedClients.length}
                        onClick={() => requestClientPrint(true)}
                      >
                        Imprimir selecionados
                      </button>
                      <button
                        type="button"
                        className="button primary compact-button"
                        disabled={!sortedClients.length}
                        onClick={() => requestClientPrint(false)}
                      >
                        Imprimir filtro
                      </button>
                      <button
                        className="button ghost compact-button"
                        onClick={() => exportClientsCsv(filteredClients, `primecheck_${resultProfile.id}.csv`, resultProfile.recordLabel)}
                      >
                        Exportar CSV filtrado
                      </button>
                    </div>
                  </div>
                  <div className="table-wrap stable-filter-table-wrap">
                    <table className="records-table analytic-report-table">
                      <thead>
                        <tr>
                          <th className="selection-column">
                            <input
                              type="checkbox"
                              checked={allCurrentClientsSelected}
                              onChange={toggleCurrentClientPage}
                              aria-label="Selecionar página"
                            />
                          </th>
                          <SortableHeader label="Código" sortKey="code" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />
                          <SortableHeader
                            label={
                              showGroupHierarchy
                                ? 'Seção | Grupo'
                                : showSubgroupHierarchy
                                  ? 'Seção | Grupo | Subgrupo'
                                  : resultProfile.recordLabel
                            }
                            sortKey="name"
                            sort={clientSort}
                            onSort={key => setClientSort(current => nextSort(current, key))}
                          />
                          <SortableHeader label="Encontrado" sortKey="found" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />
                          <SortableHeader label="Resultado" sortKey="status" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />
                          <SortableHeader label="Divergências" sortKey="divergent" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />
                          <SortableHeader label="Atenções" sortKey="attention" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />
                          {showDocument && <SortableHeader label="CPF/CNPJ origem" sortKey="document" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />}
                          {showDocument && <SortableHeader label="Validade" sortKey="validity" sort={clientSort} onSort={key => setClientSort(current => nextSort(current, key))} />}
                          <th>Análise</th>
                          <th>Ação</th>
                        </tr>
                        <tr className="column-filter-row">
                          <th />
                          <th><input value={clientColumnFilters.code} onChange={e => setClientColumnFilters(current => ({ ...current, code: e.target.value }))} placeholder="Filtrar…" /></th>
                          <th><input value={clientColumnFilters.name} onChange={e => setClientColumnFilters(current => ({ ...current, name: e.target.value }))} placeholder="Filtrar…" /></th>
                          <th>
                            <select value={clientColumnFilters.found} onChange={e => setClientColumnFilters(current => ({ ...current, found: e.target.value }))}>
                              <option value="TODOS">Todos</option>
                              <option value="SIM">Sim</option>
                              <option value="NAO">Não</option>
                            </select>
                          </th>
                          <th>
                            <select value={clientColumnFilters.status} onChange={e => setClientColumnFilters(current => ({ ...current, status: e.target.value }))}>
                              <option value="TODOS">Todos</option>
                              <option value="CONFORME">Conforme</option>
                              <option value="DIVERGENTE">Divergente</option>
                              <option value="ATENÇÃO">Atenção</option>
                              <option value="NÃO IMPORTADO">Não importado</option>
                            </select>
                          </th>
                          <th><input value={clientColumnFilters.divergent} onChange={e => setClientColumnFilters(current => ({ ...current, divergent: e.target.value }))} placeholder="Qtd." /></th>
                          <th><input value={clientColumnFilters.attention} onChange={e => setClientColumnFilters(current => ({ ...current, attention: e.target.value }))} placeholder="Qtd." /></th>
                          {showDocument && <th><input value={clientColumnFilters.document} onChange={e => setClientColumnFilters(current => ({ ...current, document: e.target.value }))} placeholder="Filtrar…" /></th>}
                          {showDocument && (
                            <th>
                              <select value={clientColumnFilters.validity} onChange={e => setClientColumnFilters(current => ({ ...current, validity: e.target.value }))}>
                                <option value="TODOS">Todos</option>
                                <option value="VÁLIDO">Válido</option>
                                <option value="INVÁLIDO">Inválido</option>
                                <option value="AUSENTE">Ausente</option>
                              </select>
                            </th>
                          )}
                          <th />
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {currentClientPage.map(client => {
                          const doc = client.fields.find(f => f.fieldId === 'cpfCnpj')?.originValue ?? ''
                          const validation = validateCpfCnpj(doc)
                          const reviewed = reviewedClientKeys.has(client.key)
                          const hierarchy = hierarchyForClient(client)
                          return <tr key={client.key} className={reviewed ? 'row-reviewed' : ''}>
                            <td className="selection-column">
                              <input
                                type="checkbox"
                                checked={selectedClientKeys.has(client.key)}
                                onChange={() => setSelectedClientKeys(current => toggleStringSet(current, client.key))}
                              />
                            </td>
                            <td className="mono">{client.key}</td>
                            <td>
                              {showGroupHierarchy ? (
                                <div className="hierarchy-inline-label" title={hierarchyDisplayForClient(client)}>
                                  <span>{hierarchy.sectionName || (hierarchy.sectionCode ? 'Seção ' + hierarchy.sectionCode : 'Seção')}</span>
                                  <i aria-hidden="true">|</i>
                                  <strong>{client.name || '—'}</strong>
                                </div>
                              ) : showSubgroupHierarchy ? (
                                <div className="hierarchy-inline-label" title={hierarchyDisplayForClient(client)}>
                                  <span>{hierarchy.sectionName || (hierarchy.sectionCode ? 'Seção ' + hierarchy.sectionCode : 'Seção')}</span>
                                  <i aria-hidden="true">|</i>
                                  <span>{hierarchy.groupName || (hierarchy.groupCode ? 'Grupo ' + hierarchy.groupCode : 'Grupo')}</span>
                                  <i aria-hidden="true">|</i>
                                  <strong>{client.name || '—'}</strong>
                                </div>
                              ) : (
                                <strong>{client.name || '—'}</strong>
                              )}
                            </td>
                            <td>{client.found ? 'Sim' : 'Não'}</td>
                            <td><StatusBadge status={client.status} /></td>
                            <td>{client.divergentCount}</td>
                            <td>{client.attentionCount}</td>
                            {showDocument && <td className="mono">{doc || '—'}</td>}
                            {showDocument && <td><span className={`validity ${validation.status === 'VÁLIDO' ? 'valid' : 'warn'}`}>{validation.status}</span></td>}
                            <td>
                              <button
                                type="button"
                                className={'review-chip ' + (reviewed ? 'done' : '')}
                                onClick={() => setReviewedClientKeys(current => toggleStringSet(current, client.key))}
                              >
                                {reviewed ? '✓ Analisado' : 'Marcar analisado'}
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="analysis-action-button"
                                onClick={() => {
                                  setReviewedClientKeys(current => new Set(current).add(client.key))
                                  openRecord(client)
                                }}
                              >
                                Abrir análise
                              </button>
                            </td>
                          </tr>
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} pages={pageCount(sortedClients)} onChange={setPage} />
                </div>

                <DataPrintReport
                  title={`Relatório de ${resultProfile.label}`}
                  subtitle="Registros conforme filtros e seleção aplicados na tela"
                  filterDescription={[
                    search.trim() ? 'Pesquisa: ' + search.trim() : '',
                    clientColumnFilters.code ? 'Código: ' + clientColumnFilters.code : '',
                    clientColumnFilters.name
                      ? (showGroupHierarchy
                          ? 'Seção | Grupo'
                          : showSubgroupHierarchy
                            ? 'Seção | Grupo | Subgrupo'
                            : resultProfile.recordLabel) + ': ' + clientColumnFilters.name
                      : '',
                    clientColumnFilters.found !== 'TODOS' ? 'Encontrado: ' + clientColumnFilters.found : '',
                    clientColumnFilters.status !== 'TODOS' ? 'Resultado: ' + clientColumnFilters.status : '',
                    clientColumnFilters.document ? 'CPF/CNPJ: ' + clientColumnFilters.document : '',
                    clientColumnFilters.validity !== 'TODOS' ? 'Validade: ' + clientColumnFilters.validity : '',
                    clientPrintSelected ? 'Somente registros selecionados' : 'Resultado filtrado',
                  ].filter(Boolean).join(' · ')}
                  columns={[
                    { key: 'codigo', label: 'Código' },
                    {
                      key: 'registro',
                      label: showGroupHierarchy
                        ? 'Seção | Grupo'
                        : showSubgroupHierarchy
                          ? 'Seção | Grupo | Subgrupo'
                          : resultProfile.recordLabel,
                    },
                    { key: 'encontrado', label: 'Encontrado' },
                    { key: 'resultado', label: 'Resultado' },
                    { key: 'divergencias', label: 'Divergências' },
                    { key: 'atencoes', label: 'Atenções' },
                    ...(showDocument ? [
                      { key: 'documento', label: 'CPF/CNPJ origem' },
                      { key: 'validade', label: 'Validade' },
                    ] : []),
                    { key: 'analisado', label: 'Analisado' },
                  ]}
                  rows={(clientPrintSelected ? selectedClients : sortedClients).map(client => {
                    const doc = client.fields.find(field => field.fieldId === 'cpfCnpj')?.originValue ?? ''
                    return {
                      codigo: client.key,
                      registro: showGroupHierarchy || showSubgroupHierarchy
                        ? hierarchyDisplayForClient(client)
                        : client.name || '—',
                      encontrado: client.found ? 'Sim' : 'Não',
                      resultado: client.status,
                      divergencias: client.divergentCount,
                      atencoes: client.attentionCount,
                      documento: doc || '—',
                      validade: showDocument ? validateCpfCnpj(doc).status : '',
                      analisado: reviewedClientKeys.has(client.key) ? 'Sim' : 'Não',
                    }
                  })}
                />
              </>
            )}

            {activeTab === 'issues' && (
              <>
                <div className="panel issues-panel">
                  {fieldAnalysis && (
                    <div className="field-analysis-banner">
                      <div className="field-analysis-copy">
                        <span className="eyebrow">ANÁLISE DO CAMPO</span>
                        <strong>{fieldAnalysis.fieldLabel}</strong>
                        <span>{fieldAnalysis.group}</span>
                      </div>
                      <div className="field-analysis-meta">
                        <span className={`analysis-status-badge ${statusFilter === 'DIVERGENTE' ? 'error' : statusFilter === 'ATENÇÃO' ? 'warning' : 'mixed'}`}>
                          {analysisStatusLabel}
                        </span>
                        <span className="field-analysis-count">{analysisCountLabel}</span>
                      </div>
                      <div className="field-analysis-actions">
                        <button type="button" className="button ghost compact-button" onClick={backToFields}>
                          Voltar para Por campo
                        </button>
                        <button type="button" className="button secondary compact-button" onClick={clearIssueFieldFilter}>
                          Limpar filtro do campo
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="section-head compact issues-section-head">
                    <div>
                      <h3>Divergências e atenções</h3>
                      <p>
                        {number(issues.length)} {issues.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                        {issues.length !== issueScope.length ? ` · ${number(issueScope.length)} no contexto da análise` : ' no contexto atual'}.
                      </p>
                    </div>
                    <div className="issue-print-actions">
                      <span className="issue-selection-count">
                        {number(selectedIssues.length)} selecionada{selectedIssues.length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        className="button ghost compact-button"
                        onClick={() => {
                          setSearch('')
                          setIssueFieldFilter('TODOS')
                          setStatusFilter('TODOS')
                          setIssueDuplicateFilter('TODOS')
                          setIssueColumnFilters({ code: '', name: '', origin: '', target: '', reason: '' })
                        }}
                      >
                        Limpar filtros
                      </button>
                      <button
                        type="button"
                        className="button ghost compact-button"
                        onClick={toggleCurrentIssuePage}
                        disabled={!currentIssuePage.length}
                      >
                        {allCurrentIssuesSelected ? 'Desmarcar página' : 'Selecionar página'}
                      </button>
                      <button
                        type="button"
                        className="button secondary compact-button"
                        onClick={() => setSelectedIssueKeys(new Set())}
                        disabled={!selectedIssues.length}
                      >
                        Limpar seleção
                      </button>
                      <button
                        type="button"
                        className="button secondary compact-button"
                        onClick={() => requestIssuePrint(selectedIssues)}
                        disabled={!selectedIssues.length}
                      >
                        Imprimir selecionados
                      </button>
                      <button
                        type="button"
                        className="button primary compact-button"
                        onClick={() => requestIssuePrint(sortedIssues)}
                        disabled={!sortedIssues.length}
                      >
                        Imprimir filtro
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap stable-filter-table-wrap">
                    <table className={fieldAnalysis ? 'issues-table issues-table-focused analytic-report-table' : 'issues-table analytic-report-table'}>
                      <thead>
                        <tr>
                          <th className="issue-select-col">
                            <input
                              type="checkbox"
                              checked={allCurrentIssuesSelected}
                              onChange={toggleCurrentIssuePage}
                              aria-label="Selecionar ocorrências da página"
                            />
                          </th>
                          <SortableHeader label="Código" sortKey="code" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label={resultProfile.recordLabel} sortKey="name" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label="Campo" sortKey="field" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label="Origem" sortKey="origin" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label="Destino" sortKey="target" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label="Status" sortKey="status" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <SortableHeader label="Motivo" sortKey="reason" sort={issueSort} onSort={key => setIssueSort(current => nextSort(current, key))} />
                          <th>Análise</th>
                          <th>Ação</th>
                        </tr>
                        <tr className="column-filter-row">
                          <th />
                          <th><input value={issueColumnFilters.code} onChange={e => setIssueColumnFilters(current => ({ ...current, code: e.target.value }))} placeholder="Código…" /></th>
                          <th><input value={issueColumnFilters.name} onChange={e => setIssueColumnFilters(current => ({ ...current, name: e.target.value }))} placeholder="Registro…" /></th>
                          <th>
                            <select value={issueFieldFilter} onChange={e => setIssueFieldFilter(e.target.value)}>
                              <option value="TODOS">Todos os campos</option>
                              {issueFieldOptions.map(field => (
                                <option key={field.fieldId} value={field.fieldId}>{field.fieldLabel}</option>
                              ))}
                            </select>
                          </th>
                          <th><input value={issueColumnFilters.origin} onChange={e => setIssueColumnFilters(current => ({ ...current, origin: e.target.value }))} placeholder="Origem…" /></th>
                          <th><input value={issueColumnFilters.target} onChange={e => setIssueColumnFilters(current => ({ ...current, target: e.target.value }))} placeholder="Destino…" /></th>
                          <th>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                              <option value="TODOS">Todos</option>
                              <option value="DIVERGENTE">Divergente</option>
                              <option value="ATENÇÃO">Atenção</option>
                            </select>
                          </th>
                          <th><input value={issueColumnFilters.reason} onChange={e => setIssueColumnFilters(current => ({ ...current, reason: e.target.value }))} placeholder="Motivo…" /></th>
                          <th />
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {currentIssuePage.map((item, idx) => {
                          const occurrenceKey = occurrenceKeyOf(item.client.key, item.field.fieldId)
                          const highlight = issueFieldFilter !== 'TODOS'
                          const showCharacterCount = Boolean(item.field.originValue || item.field.targetValue)
                          return (
                            <tr
                              key={`${item.client.key}-${item.field.fieldId}-${idx}`}
                              className={[
                                selectedIssueKeys.has(occurrenceKey) ? 'issue-row-selected' : '',
                                reviewedIssueKeys.has(occurrenceKey) ? 'row-reviewed' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <td className="issue-select-col">
                                <input
                                  type="checkbox"
                                  checked={selectedIssueKeys.has(occurrenceKey)}
                                  onChange={() => toggleIssueSelection(occurrenceKey)}
                                  aria-label={`Selecionar ${item.client.key} · ${item.field.fieldLabel}`}
                                />
                              </td>
                              <td className="mono">{item.client.key}</td>
                              <td>
                                <button
                                  type="button"
                                  className="link-button left"
                                  onClick={() => {
                                    setReviewedIssueKeys(current => new Set(current).add(occurrenceKey))
                                    openRecord(item.client, item.field.fieldId, occurrenceKey)
                                  }}
                                >
                                  {item.client.name || '—'}
                                </button>
                              </td>
                              <td>
                                <strong>{item.field.fieldLabel}</strong>
                                <small className="block-muted">{item.field.group}</small>
                                {item.field.manualAdjustment && <small className="block-muted text-warning">Ajustado manualmente</small>}
                              </td>
                              <td>
                                <IssueValueCell
                                  label="Origem"
                                  value={item.field.originValue}
                                  status={item.field.status}
                                  highlight={highlight}
                                  showCharacterCount={showCharacterCount}
                                  duplicate={item.duplicate}
                                  onOpenDuplicate={item.duplicate
                                    ? () => openDuplicateAnalysis(
                                      item.field.fieldId,
                                      item.field.fieldLabel,
                                      item.duplicate!.normalizedValue,
                                      'ORIGEM',
                                    )
                                    : undefined}
                                />
                              </td>
                              <td>
                                <IssueValueCell
                                  label="Destino"
                                  value={item.field.targetValue}
                                  status={item.field.status}
                                  highlight={highlight}
                                  showCharacterCount={showCharacterCount}
                                />
                              </td>
                              <td><StatusBadge status={item.field.status} /></td>
                              <td className="reason-cell">{item.field.reason}</td>
                              <td>
                                <button
                                  type="button"
                                  className={'review-chip ' + (reviewedIssueKeys.has(occurrenceKey) ? 'done' : '')}
                                  onClick={() => setReviewedIssueKeys(current => toggleStringSet(current, occurrenceKey))}
                                >
                                  {reviewedIssueKeys.has(occurrenceKey) ? '✓ Analisado' : 'Marcar analisado'}
                                </button>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="analysis-action-button"
                                  onClick={() => {
                                    setReviewedIssueKeys(current => new Set(current).add(occurrenceKey))
                                    openRecord(item.client, item.field.fieldId, occurrenceKey)
                                  }}
                                >
                                  Abrir análise
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} pages={pageCount(sortedIssues)} onChange={setPage} />
                </div>

                <IssuePrintReport
                  items={issuePrintItems}
                  profileLabel={resultProfile.label}
                  recordLabel={resultProfile.recordLabel}
                  filterDescription={issuePrintFilterDescription}
                />
              </>
            )}

            {activeTab === 'fields' && <FieldSummaryView report={report} onAnalyzeField={openFieldAnalysis} />}
            {activeTab === 'duplicates' && (
              <DuplicatesView
                report={report}
                profile={resultProfile}
                initialFieldId={duplicateFieldFocus}
                initialSearch={duplicateSearchFocus}
                initialSide={duplicateSideFocus}
              />
            )}
            {activeTab === 'missing' && <MissingView report={report} profile={resultProfile} onOpenClient={client => openRecord(client)} />}
          </section>
        )}
      </main>

      <footer>
        <span>PrimeCheck · Conversão & Homologação de Dados</span>
        <span>Arquivos processados localmente no navegador.</span>
      </footer>

      <ClientDrawer
        client={selectedClient}
        recordLabel={resultProfile.recordLabel}
        showDocumentValidity={showDocument}
        focusedFieldId={drawerFocusedFieldId}
        occurrenceNav={occurrenceNav}
        onClose={() => {
          setSelectedClient(null)
          setFocusedFieldId(undefined)
          setSelectedOccurrenceKey(null)
        }}
        onApplyManualAdjustment={handleManualAdjustment}
        onRevertManualAdjustment={handleRevertManualAdjustment}
      />

      {duplicateAnalysis && (
        <DuplicateAnalysisModal
          request={duplicateAnalysis}
          group={duplicateAnalysisGroup}
          nameLabel={resultProfile.fields.find(field => field.id === resultProfile.nameFieldId)?.label ?? resultProfile.recordLabel}
          onClose={() => setDuplicateAnalysis(null)}
          onOpenDuplicatesScreen={() => {
            const target = duplicateAnalysis
            setDuplicateAnalysis(null)
            openDuplicates(target.fieldId, target.normalizedValue, target.side)
          }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, note, tone = '' }: { label: string; value: number; note: string; tone?: string }) {
  return <div className={`kpi ${tone}`}><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></div>
}

function PageSizeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <select
      className="page-size-select"
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      aria-label="Registros por página"
    >
      <option value={10}>10 por página</option>
      <option value={20}>20 por página</option>
      <option value={50}>50 por página</option>
    </select>
  )
}

function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onChange(1)} aria-label="Primeira página">«</button>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>← Anterior</button>
      <span>Página <strong>{page}</strong> de <strong>{pages}</strong></span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima →</button>
      <button disabled={page >= pages} onClick={() => onChange(pages)} aria-label="Última página">»</button>
    </div>
  )
}

function Overview({
  report,
  profile,
  onOpenClient,
}: {
  report: ComparisonReport
  profile: EntityProfile
  onOpenClient: (client: ClientComparison) => void
}) {
  const [search, setSearch] = useState('')
  const term = search.trim().toLocaleUpperCase('pt-BR')
  const cpfField = report.fieldSummary.find(field => field.fieldId === 'cpfCnpj')
  const critical = report.clients
    .filter(client => client.status === 'DIVERGENTE')
    .filter(client => !term || (client.key + ' ' + client.name).toLocaleUpperCase('pt-BR').includes(term))
    .sort((a, b) => b.divergentCount - a.divergentCount)
    .slice(0, 8)
  const worstFields = [...report.fieldSummary]
    .filter(field => field.divergent || field.attention)
    .filter(field => !term || (field.fieldLabel + ' ' + field.group).toLocaleUpperCase('pt-BR').includes(term))
    .sort((a, b) => (b.divergent * 2 + b.attention) - (a.divergent * 2 + a.attention))
    .slice(0, 8)

  const printRows = [
    ...worstFields.map(field => ({
      tipo: 'Campo',
      referencia: field.fieldLabel,
      grupo: field.group,
      resumo: `${field.divergent} divergências · ${field.attention} atenções · ${field.conformityPercent === null ? '—' : field.conformityPercent.toFixed(2).replace('.', ',') + '%'} conformidade`,
    })),
    ...critical.map(client => ({
      tipo: profile.recordLabel,
      referencia: client.key,
      grupo: client.name || '—',
      resumo: `${client.divergentCount} divergências · ${client.attentionCount} atenções`,
    })),
  ]

  return (
    <>
      <div className="overview-toolbar">
        <div className="screen-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar no resumo por campo, código ou registro…"
            aria-label="Pesquisar no resumo"
          />
        </div>
        <button
          type="button"
          className="button secondary compact-button"
          disabled={!printRows.length}
          onClick={() => window.print()}
        >
          Imprimir resumo
        </button>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-head compact"><div><h3>Campos que mais exigem revisão</h3><p>Priorizados por divergência e atenção.</p></div></div>
          <div className="field-ranking stable-filter-list">
            {worstFields.map(field => (
              <div className="rank-row" key={field.fieldId}>
                <div><strong>{field.fieldLabel}</strong><span>{field.group}</span></div>
                <div className="rank-metrics">
                  <span className="metric-error">{field.divergent} erros</span>
                  <span className="metric-warning">{field.attention} avisos</span>
                  <strong>{field.conformityPercent === null ? '—' : field.conformityPercent.toFixed(1) + '%'}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-head compact"><div><h3>Registros prioritários</h3><p>{profile.label} com maior quantidade de divergências.</p></div></div>
          <div className="priority-list stable-filter-list">
            {critical.map(client => (
              <button key={client.key} onClick={() => onOpenClient(client)}>
                <span className="mono">{client.key}</span>
                <div><strong>{client.name || 'Sem descrição'}</strong><small>{client.divergentCount} divergências · {client.attentionCount} atenções</small></div>
                <span>→</span>
              </button>
            ))}
            {!critical.length && !term && <div className="empty-state">Nenhum registro divergente. Excelente resultado.</div>}
          </div>
        </section>
        {profile.showDocumentValidity && (
          <section className="panel wide insight-panel">
            <div className="insight-icon">✓</div>
            <div><span className="eyebrow">REGRA CPF/CNPJ</span><h3>Validação de documento incorporada</h3><p>CPF/CNPJ válido na origem e diferente no destino é classificado como erro. Documento ausente ou inválido na origem com valor gerado no destino é tratado como atenção.</p></div>
            <div className="insight-stat"><strong>{cpfField ? cpfField.divergent : 0}</strong><span>erros de documento</span></div>
          </section>
        )}
      </div>

      <DataPrintReport
        title="Visão geral da homologação"
        subtitle={profile.label + ' · campos e registros prioritários'}
        filterDescription={search.trim() ? 'Pesquisa: ' + search.trim() : 'Resumo sem filtro adicional'}
        columns={[
          { key: 'tipo', label: 'Tipo' },
          { key: 'referencia', label: 'Referência' },
          { key: 'grupo', label: 'Grupo / registro' },
          { key: 'resumo', label: 'Resumo técnico' },
        ]}
        rows={printRows}
      />
    </>
  )
}

function IssueValueCell({
  label,
  value,
  status,
  highlight,
  showCharacterCount = false,
  duplicate,
  onOpenDuplicate,
}: {
  label: string
  value: string
  status: Severity
  highlight: boolean
  showCharacterCount?: boolean
  duplicate?: IssueDuplicateInfo
  onOpenDuplicate?: () => void
}) {
  const tone = highlight
    ? status === 'DIVERGENTE'
      ? 'issue-value-divergent'
      : status === 'ATENÇÃO'
        ? 'issue-value-attention'
        : ''
    : ''
  const length = Array.from(value || '').length

  return (
    <div className={`issue-value ${tone}`.trim()}>
      <small>{label}</small>
      <strong>{value || '—'}</strong>
      {showCharacterCount && (
        <span className="issue-char-count">
          {length} {length === 1 ? 'caractere' : 'caracteres'}
        </span>
      )}
      {duplicate && onOpenDuplicate && (
        <button
          type="button"
          className="issue-duplicate-link"
          onClick={onOpenDuplicate}
          title="Analisar duplicidade"
          aria-haspopup="dialog"
        >
          Duplicado · {number(duplicate.count)}x
        </button>
      )}
    </div>
  )
}

function FieldSummaryView({
  report,
  onAnalyzeField,
}: {
  report: ComparisonReport
  onAnalyzeField: (fieldId: string, status: 'TODOS' | 'DIVERGENTE' | 'ATENÇÃO') => void
}) {
  const PAGE_SIZE = 20
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'field', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [printSelected, setPrintSelected] = useState(false)
  const [filters, setFilters] = useState({
    group: '',
    field: '',
    conform: '',
    divergent: '',
    attention: '',
    notValidatable: '',
    conformity: '',
  })
  const term = search.trim().toLocaleUpperCase('pt-BR')
  const contains = (value: unknown, filter: string) =>
    !filter.trim() || String(value ?? '').toLocaleUpperCase('pt-BR').includes(filter.trim().toLocaleUpperCase('pt-BR'))

  const fields = useMemo(() => {
    const filtered = report.fieldSummary.filter(field => {
      if (!contains(field.group, filters.group)) return false
      if (!contains(field.fieldLabel, filters.field)) return false
      if (!contains(field.conform, filters.conform)) return false
      if (!contains(field.divergent, filters.divergent)) return false
      if (!contains(field.attention, filters.attention)) return false
      if (!contains(field.notValidatable, filters.notValidatable)) return false
      if (!contains(field.conformityPercent === null ? '' : field.conformityPercent.toFixed(2), filters.conformity)) return false
      if (!term) return true
      return (field.fieldLabel + ' ' + field.group + ' ' + field.conform + ' ' + field.divergent + ' ' + field.attention + ' ' + field.notValidatable + ' ' + (field.conformityPercent ?? ''))
        .toLocaleUpperCase('pt-BR')
        .includes(term)
    })
    return sortedBy(filtered, sort, (field, key) => {
      if (key === 'group') return field.group
      if (key === 'field') return field.fieldLabel
      if (key === 'conform') return field.conform
      if (key === 'divergent') return field.divergent
      if (key === 'attention') return field.attention
      if (key === 'notValidatable') return field.notValidatable
      if (key === 'conformity') return field.conformityPercent ?? -1
      return ''
    })
  }, [report.fieldSummary, search, sort, filters])

  useEffect(() => setPage(1), [search, filters, sort.key, sort.direction])

  const pages = Math.max(1, Math.ceil(fields.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const pageFields = fields.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageIds = pageFields.map(field => field.fieldId)
  const selectedFields = fields.filter(field => selected.has(field.fieldId))
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id))

  const clearFilters = () => {
    setSearch('')
    setFilters({
      group: '',
      field: '',
      conform: '',
      divergent: '',
      attention: '',
      notValidatable: '',
      conformity: '',
    })
  }

  const togglePage = () => {
    setSelected(current => {
      const next = new Set(current)
      if (allPageSelected) pageIds.forEach(id => next.delete(id))
      else pageIds.forEach(id => next.add(id))
      return next
    })
  }

  const requestPrint = (onlySelected: boolean) => {
    setPrintSelected(onlySelected)
    window.setTimeout(() => window.print(), 80)
  }

  const rowsForPrint = printSelected ? selectedFields : fields

  return (
    <>
      <div className="panel">
        <div className="section-head compact">
          <div>
            <h3>Comparação por campo</h3>
            <p>Pesquise, combine filtros e acompanhe a análise em páginas de {PAGE_SIZE} campos.</p>
          </div>
          <div className="section-head-actions">
            <span className="selection-summary">{selectedFields.length.toLocaleString('pt-BR')} selecionados</span>
            <button type="button" className="button ghost compact-button" onClick={clearFilters}>Limpar filtros</button>
            <button type="button" className="button ghost compact-button" disabled={!pageFields.length} onClick={togglePage}>
              {allPageSelected ? 'Desmarcar página' : 'Selecionar página'}
            </button>
            <button type="button" className="button secondary compact-button" disabled={!selectedFields.length} onClick={() => requestPrint(true)}>
              Imprimir selecionados
            </button>
            <button type="button" className="button primary compact-button" disabled={!fields.length} onClick={() => requestPrint(false)}>
              Imprimir filtro
            </button>
          </div>
        </div>

        <div className="screen-search inline-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar em todos os campos e indicadores…"
            aria-label="Pesquisar comparação por campo"
          />
        </div>

        <div className="table-wrap stable-filter-table-wrap">
          <table className="field-summary-table analytic-report-table">
            <thead>
              <tr>
                <th className="selection-column"><input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Selecionar página" /></th>
                <SortableHeader label="Grupo" sortKey="group" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Campo" sortKey="field" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Conformes" sortKey="conform" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Divergentes" sortKey="divergent" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Atenções" sortKey="attention" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Não validáveis" sortKey="notValidatable" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="% conformidade" sortKey="conformity" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <th>Análise</th>
              </tr>
              <tr className="column-filter-row">
                <th />
                <th><input value={filters.group} onChange={e => setFilters(current => ({ ...current, group: e.target.value }))} placeholder="Grupo…" /></th>
                <th><input value={filters.field} onChange={e => setFilters(current => ({ ...current, field: e.target.value }))} placeholder="Campo…" /></th>
                <th><input value={filters.conform} onChange={e => setFilters(current => ({ ...current, conform: e.target.value }))} placeholder="Qtd." /></th>
                <th><input value={filters.divergent} onChange={e => setFilters(current => ({ ...current, divergent: e.target.value }))} placeholder="Qtd." /></th>
                <th><input value={filters.attention} onChange={e => setFilters(current => ({ ...current, attention: e.target.value }))} placeholder="Qtd." /></th>
                <th><input value={filters.notValidatable} onChange={e => setFilters(current => ({ ...current, notValidatable: e.target.value }))} placeholder="Qtd." /></th>
                <th><input value={filters.conformity} onChange={e => setFilters(current => ({ ...current, conformity: e.target.value }))} placeholder="%…" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageFields.map(field => {
                const reviewCount = field.divergent + field.attention
                const conformity = field.conformityPercent ?? 0
                const isReviewed = reviewed.has(field.fieldId)
                return (
                  <tr key={field.fieldId} className={isReviewed ? 'row-reviewed' : ''}>
                    <td className="selection-column">
                      <input
                        type="checkbox"
                        checked={selected.has(field.fieldId)}
                        onChange={() => setSelected(current => toggleStringSet(current, field.fieldId))}
                      />
                    </td>
                    <td className="muted-cell">{field.group}</td>
                    <td>
                      {reviewCount > 0 ? (
                        <button
                          type="button"
                          className="field-analysis-link"
                          onClick={() => {
                            setReviewed(current => new Set(current).add(field.fieldId))
                            onAnalyzeField(field.fieldId, 'TODOS')
                          }}
                        >
                          {field.fieldLabel}
                        </button>
                      ) : (
                        <span>{field.fieldLabel}</span>
                      )}
                    </td>
                    <td>{number(field.conform)}</td>
                    <td className="text-error">
                      {field.divergent > 0 ? (
                        <button
                          type="button"
                          className="issue-count-link issue-count-link-divergent"
                          onClick={() => {
                            setReviewed(current => new Set(current).add(field.fieldId))
                            onAnalyzeField(field.fieldId, 'DIVERGENTE')
                          }}
                        >
                          {number(field.divergent)}
                        </button>
                      ) : number(field.divergent)}
                    </td>
                    <td className="text-warning">
                      {field.attention > 0 ? (
                        <button
                          type="button"
                          className="issue-count-link issue-count-link-attention"
                          onClick={() => {
                            setReviewed(current => new Set(current).add(field.fieldId))
                            onAnalyzeField(field.fieldId, 'ATENÇÃO')
                          }}
                        >
                          {number(field.attention)}
                        </button>
                      ) : number(field.attention)}
                    </td>
                    <td>{number(field.notValidatable)}</td>
                    <td>
                      {field.conformityPercent === null ? (
                        '—'
                      ) : (
                        <div className="field-progress">
                          <div className="field-progress-track">
                            <i style={{ width: String(conformity) + '%' }} />
                          </div>
                          <span>{conformity.toFixed(2).replace('.', ',')}%</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={'review-chip ' + (isReviewed ? 'done' : '')}
                        onClick={() => setReviewed(current => toggleStringSet(current, field.fieldId))}
                      >
                        {isReviewed ? '✓ Analisado' : 'Marcar analisado'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="workspace-pagination dashboard-pagination">
          <span>
            {fields.length
              ? `${((safePage - 1) * PAGE_SIZE + 1).toLocaleString('pt-BR')}–${Math.min(safePage * PAGE_SIZE, fields.length).toLocaleString('pt-BR')} de ${fields.length.toLocaleString('pt-BR')}`
              : '0 registros'}
          </span>
          <div>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>←</button>
            <b>{safePage}/{pages}</b>
            <button type="button" disabled={safePage >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>→</button>
          </div>
        </div>
      </div>

      <DataPrintReport
        title="Comparação por campo"
        subtitle="Resumo dos campos conforme filtros e seleção aplicados"
        filterDescription={[
          search.trim() ? 'Pesquisa: ' + search.trim() : '',
          filters.group ? 'Grupo: ' + filters.group : '',
          filters.field ? 'Campo: ' + filters.field : '',
          filters.divergent ? 'Divergências: ' + filters.divergent : '',
          filters.attention ? 'Atenções: ' + filters.attention : '',
          filters.conformity ? 'Conformidade: ' + filters.conformity : '',
          printSelected ? 'Somente campos selecionados' : 'Resultado filtrado',
        ].filter(Boolean).join(' · ')}
        columns={[
          { key: 'grupo', label: 'Grupo' },
          { key: 'campo', label: 'Campo' },
          { key: 'conformes', label: 'Conformes' },
          { key: 'divergentes', label: 'Divergentes' },
          { key: 'atencoes', label: 'Atenções' },
          { key: 'naoValidaveis', label: 'Não validáveis' },
          { key: 'conformidade', label: '% conformidade' },
          { key: 'analisado', label: 'Analisado' },
        ]}
        rows={rowsForPrint.map(field => ({
          grupo: field.group,
          campo: field.fieldLabel,
          conformes: field.conform,
          divergentes: field.divergent,
          atencoes: field.attention,
          naoValidaveis: field.notValidatable,
          conformidade: field.conformityPercent === null ? '—' : field.conformityPercent.toFixed(2).replace('.', ',') + '%',
          analisado: reviewed.has(field.fieldId) ? 'Sim' : 'Não',
        }))}
      />
    </>
  )
}

type DuplicateReportMode = 'ANALITICO' | 'SINTETICO'

type DuplicateSyntheticRow = {
  key: string
  side: ComparisonReport['duplicates'][number]['side']
  fieldId: string
  fieldLabel: string
  category: string
  normalizedValue: string
  recordCount: number
  codes: string[]
}

function summarizeDuplicates(items: ComparisonReport['duplicates']): DuplicateSyntheticRow[] {
  return items.map((dup, index) => ({
    key: [dup.side, dup.fieldId, dup.normalizedValue, index].join('::'),
    side: dup.side,
    fieldId: dup.fieldId,
    fieldLabel: dup.fieldLabel,
    category: dup.category,
    normalizedValue: dup.normalizedValue,
    recordCount: dup.count,
    codes: dup.records.map(record => record.key).filter(Boolean),
  }))
}

function DuplicatePrintReport({
  items,
  profile,
  filterDescription,
  generatedAt,
}: {
  items: ComparisonReport['duplicates']
  profile: EntityProfile
  filterDescription: string
  generatedAt: string
}) {
  const nameLabel = profile.fields.find(field => field.id === profile.nameFieldId)?.label
    || (profile.id === 'product' ? 'Descrição' : profile.id === 'supplier' ? 'Razão Social' : 'Nome')
  const printedAt = formatReportDateTime(generatedAt)

  return (
    <section className="dup-print-report" aria-hidden="true">
      {items.map((dup, groupIndex) => {
        const ctx = {
          fieldId: dup.fieldId,
          fieldLabel: dup.fieldLabel,
          normalizedValue: dup.normalizedValue,
          nameLabel,
        }
        const codes = dup.records.map(record => record.key).filter(Boolean)
        return (
          <article
            className="dup-print-page"
            key={dup.side + '-' + dup.fieldId + '-' + dup.normalizedValue + '-' + groupIndex}
          >
            <header className="dup-print-head">
              <span className="dup-print-brand">PrimeCheck</span>
              <h1>Relatório de Duplicidades</h1>
              <p>{profile.label}</p>
              <div className="dup-print-summary">
                <div><span>Data/hora de geração</span><strong>{printedAt}</strong></div>
                <div><span>Grupo</span><strong>{groupIndex + 1} de {items.length}</strong></div>
                <div><span>Filtro aplicado</span><strong>{filterDescription}</strong></div>
              </div>
            </header>

            <div className="dup-print-guidance">
              <strong>Orientação para análise</strong>
              <p>
                Os registros abaixo possuem informações duplicadas no campo indicado. É necessário validar
                manualmente qual cadastro deve ser considerado principal para a conversão/importação. Na ausência
                de uma regra específica e confiável de prioridade, o processo poderá considerar um registro de
                forma não determinística, sendo recomendada análise prévia.
              </p>
            </div>

            <div className="dup-print-block">
              <div className="dup-print-group-head">
                <div>
                  <span>Grupo {groupIndex + 1}</span>
                  <h2>{dup.fieldLabel} duplicado</h2>
                  <p>{dup.category}</p>
                </div>
                <div>
                  <b>{sideLabel(dup.side)}</b>
                  <b>{number(dup.count)} {dup.count === 1 ? 'registro' : 'registros'}</b>
                </div>
              </div>

              <div className="dup-print-group-summary">
                <div><span>Lado</span><strong>{sideLabel(dup.side)}</strong></div>
                <div><span>Campo duplicado</span><strong>{dup.fieldLabel}</strong></div>
                <div><span>Tipo</span><strong>{dup.category}</strong></div>
                <div><span>Valor duplicado</span><strong className="mono">{dup.normalizedValue || '—'}</strong></div>
                <div><span>Quantidade de registros</span><strong>{number(dup.count)}</strong></div>
                <div className="dup-print-codes">
                  <span>Códigos envolvidos</span>
                  <div className="dup-print-chips">
                    {codes.length
                      ? codes.map((code, index) => <b key={code + '-' + index}>{code}</b>)
                      : <strong>—</strong>}
                  </div>
                </div>
              </div>
            </div>

            <h3 className="dup-print-records-title">Registros do grupo</h3>
            <div className="dup-print-records">
              {dup.records.map((record, recordIndex) => {
                const fields = buildRecordDisplayFields(record, ctx)
                return (
                  <div className="dup-print-record" key={record.key + '-' + recordIndex}>
                    {fields.map(field => (
                      <div
                        className={'dup-print-data' + (field.id === '__nome' ? ' main' : '') + (field.id === dup.fieldId ? ' duplicated' : '')}
                        key={record.key + '-' + field.id}
                      >
                        <span>{field.label}</span>
                        <strong className={isMonoDuplicateField(field.id) ? 'mono' : undefined}>{field.value || '—'}</strong>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </article>
        )
      })}
    </section>
  )
}

function DuplicateSyntheticPrintReport({
  rows,
  sourceItems,
  profile,
  filterDescription,
  generatedAt,
}: {
  rows: DuplicateSyntheticRow[]
  sourceItems: ComparisonReport['duplicates']
  profile: EntityProfile
  filterDescription: string
  generatedAt: string
}) {
  const printedAt = formatReportDateTime(generatedAt)
  const totalRecords = sourceItems.reduce((total, dup) => total + dup.count, 0)
  const totalFields = new Set(sourceItems.map(dup => dup.fieldId)).size

  return (
    <section className="dup-print-report dup-print-synthetic-report" aria-hidden="true">
      <article className="dup-print-synthetic-page">
        <header className="dup-print-head">
          <span className="dup-print-brand">PrimeCheck</span>
          <h1>Relatório de Duplicidades — Sintético</h1>
          <p>{profile.label}</p>
          <div className="dup-print-summary">
            <div><span>Data/hora de geração</span><strong>{printedAt}</strong></div>
            <div><span>Tipo de relatório</span><strong>Sintético</strong></div>
            <div><span>Filtro aplicado</span><strong>{filterDescription}</strong></div>
          </div>
        </header>

        <div className="dup-print-synthetic-kpis">
          <div><span>Grupos duplicados</span><strong>{number(sourceItems.length)}</strong></div>
          <div><span>Registros envolvidos</span><strong>{number(totalRecords)}</strong></div>
          <div><span>Campos com duplicidade</span><strong>{number(totalFields)}</strong></div>
        </div>

        <div className="dup-print-guidance">
          <strong>Resumo sintético</strong>
          <p>
            Cada linha representa um valor duplicado dentro dos filtros aplicados. Use campo, tipo, valor,
            quantidade e códigos envolvidos para localizar rapidamente os cadastros que exigem correção ou consolidação.
          </p>
        </div>

        <table className="dup-print-synthetic-table">
          <thead>
            <tr>
              <th>Lado</th>
              <th>Campo duplicado</th>
              <th>Tipo</th>
              <th>Valor duplicado</th>
              <th>Qtd. registros</th>
              <th>Códigos envolvidos</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}>Nenhuma duplicidade encontrada para os filtros aplicados.</td></tr>
            ) : rows.map(row => (
              <tr key={row.key}>
                <td>{sideLabel(row.side)}</td>
                <td><strong>{row.fieldLabel}</strong></td>
                <td>{row.category}</td>
                <td className="mono">{row.normalizedValue || '—'}</td>
                <td><strong>{number(row.recordCount)}</strong></td>
                <td className="dup-print-synthetic-codes">{row.codes.length ? row.codes.join(' · ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}

function DuplicatesView({
  report,
  profile,
  initialFieldId,
  initialSearch = '',
  initialSide = 'TODOS',
}: {
  report: ComparisonReport
  profile: EntityProfile
  initialFieldId?: string
  initialSearch?: string
  initialSide?: 'TODOS' | 'ORIGEM' | 'DESTINO'
}) {
  const pageSize = 20
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [fieldFilter, setFieldFilter] = useState('TODOS')
  const [sideFilter, setSideFilter] = useState<'TODOS' | 'ORIGEM' | 'DESTINO'>('TODOS')
  const [duplicateColumnFilters, setDuplicateColumnFilters] = useState({
    category: '',
    value: '',
    count: '',
    codes: '',
  })
  const [sort, setSort] = useState<SortState>({ key: 'count', direction: 'desc' })
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set())
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [reviewedGroups, setReviewedGroups] = useState<Set<string>>(new Set())
  const [printGroupId, setPrintGroupId] = useState<string | null>(null)
  const [printSelected, setPrintSelected] = useState(false)
  const [reportMode, setReportMode] = useState<DuplicateReportMode>('ANALITICO')

  const fieldOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const dup of report.duplicates) {
      if (!map.has(dup.fieldId)) map.set(dup.fieldId, dup.fieldLabel)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [report.duplicates])

  const rowIdOf = (dup: ComparisonReport['duplicates'][number]) =>
    [dup.side, dup.fieldId, dup.normalizedValue].join('::')

  const term = search.trim().toLocaleUpperCase('pt-BR')
  const filtered = useMemo(() => {
    const contains = (value: unknown, filter: string) =>
      !filter.trim() || String(value ?? '').toLocaleUpperCase('pt-BR').includes(filter.trim().toLocaleUpperCase('pt-BR'))

    return report.duplicates.filter(dup => {
      if (fieldFilter !== 'TODOS' && dup.fieldId !== fieldFilter) return false
      if (sideFilter !== 'TODOS' && dup.side !== sideFilter) return false
      if (!contains(dup.category, duplicateColumnFilters.category)) return false
      if (!contains(dup.normalizedValue, duplicateColumnFilters.value)) return false
      if (!contains(dup.count, duplicateColumnFilters.count)) return false
      const codes = dup.records.map(record => record.key).filter(Boolean).join(' ')
      if (!contains(codes, duplicateColumnFilters.codes)) return false

      if (!term) return true
      const records = dup.records.flatMap(record => [
        record.key,
        record.name,
        record.rawValue,
        ...record.extras.flatMap(extra => [extra.id, extra.label, extra.value]),
      ]).join(' ')
      const text = [
        dup.side,
        dup.fieldLabel,
        dup.fieldGroup,
        dup.category,
        dup.normalizedValue,
        dup.count,
        records,
      ].join(' ').toLocaleUpperCase('pt-BR')
      return text.includes(term)
    })
  }, [report.duplicates, search, fieldFilter, sideFilter, duplicateColumnFilters])

  const sorted = useMemo(() => sortedBy(filtered, sort, (dup, key) => {
    if (key === 'side') return dup.side
    if (key === 'field') return dup.fieldLabel
    if (key === 'category') return dup.category
    if (key === 'value') return dup.normalizedValue
    if (key === 'count') return dup.count
    if (key === 'codes') return dup.records.map(record => record.key).filter(Boolean).join(' ')
    if (key === 'records') return dup.records.map(record => record.key + ' ' + record.name).join(' ')
    return ''
  }), [filtered, sort])

  const syntheticRows = useMemo(() => summarizeDuplicates(sorted), [sorted])
  const syntheticRecordCount = useMemo(
    () => sorted.reduce((total, dup) => total + dup.count, 0),
    [sorted],
  )
  const syntheticFieldCount = useMemo(
    () => new Set(sorted.map(dup => dup.fieldId)).size,
    [sorted],
  )

  useEffect(() => setPage(1), [search, fieldFilter, sideFilter, duplicateColumnFilters, sort.key, sort.direction])
  useEffect(() => setPage(1), [reportMode])

  useEffect(() => {
    setFieldFilter(initialFieldId || 'TODOS')
    setSearch(initialSearch)
    setSideFilter(initialSide)
    setPage(1)
  }, [initialFieldId, initialSearch, initialSide])

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintGroupId(null)
      setPrintSelected(false)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const activeLength = reportMode === 'ANALITICO' ? sorted.length : syntheticRows.length
  const pages = Math.max(1, Math.ceil(activeLength / pageSize))
  const safePage = Math.min(page, pages)
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const syntheticPageItems = syntheticRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageIds = pageItems.map(rowIdOf)
  const selectedItems = sorted.filter(item => selectedGroups.has(rowIdOf(item)))
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedGroups.has(id))
  const duplicateHint = profile.showDocumentValidity
    ? 'grupos duplicados em CPF/CNPJ ou IE.'
    : 'grupos duplicados nos campos de unicidade do perfil.'
  const monoKinds = new Set(['document', 'ie', 'code', 'phone'])

  const changeReportMode = (mode: DuplicateReportMode) => {
    setReportMode(mode)
    setPrintGroupId(null)
    setPrintSelected(false)
    setPage(1)
  }

  const toggleSet = (current: Set<string>, id: string) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const toggleGroup = (rowId: string) => {
    setReviewedGroups(current => new Set(current).add(rowId))
    setOpenGroups(current => {
      const next = toggleSet(current, rowId)
      if (!next.has(rowId)) {
        setExpandedRecords(records => {
          const copy = new Set(records)
          copy.delete(rowId)
          return copy
        })
      }
      return next
    })
  }

  const togglePageSelection = () => {
    setSelectedGroups(current => {
      const next = new Set(current)
      if (allPageSelected) pageIds.forEach(id => next.delete(id))
      else pageIds.forEach(id => next.add(id))
      return next
    })
  }

  const nameLabel = profile.fields.find(field => field.id === profile.nameFieldId)?.label ?? profile.recordLabel

  const printItems = printGroupId
    ? sorted.filter(item => rowIdOf(item) === printGroupId)
    : printSelected
      ? selectedItems
      : [...sorted].sort((left, right) =>
          left.fieldLabel.localeCompare(right.fieldLabel, 'pt-BR', { sensitivity: 'base' })
          || left.side.localeCompare(right.side, 'pt-BR')
          || left.normalizedValue.localeCompare(right.normalizedValue, 'pt-BR', { numeric: true, sensitivity: 'base' }),
        )

  const filterDescription = [
    reportMode === 'ANALITICO' ? 'Relatório analítico' : 'Relatório sintético',
    sideFilter === 'TODOS' ? 'Origem e destino' : sideFilter === 'ORIGEM' ? 'Somente origem' : 'Somente destino',
    fieldFilter === 'TODOS'
      ? 'Todos os campos'
      : fieldOptions.find(([fieldId]) => fieldId === fieldFilter)?.[1] || fieldFilter,
    duplicateColumnFilters.category ? 'Tipo: ' + duplicateColumnFilters.category : '',
    duplicateColumnFilters.value ? 'Valor: ' + duplicateColumnFilters.value : '',
    duplicateColumnFilters.count ? 'Quantidade: ' + duplicateColumnFilters.count : '',
    duplicateColumnFilters.codes ? 'Códigos: ' + duplicateColumnFilters.codes : '',
    term ? 'Pesquisa: ' + search.trim() : '',
    printSelected ? 'Somente grupos selecionados' : '',
  ].filter(Boolean).join(' · ')

  const requestPrint = (groupId?: string, selectedOnly = false) => {
    setPrintGroupId(reportMode === 'ANALITICO' ? groupId || null : null)
    setPrintSelected(reportMode === 'ANALITICO' && selectedOnly)
    window.setTimeout(() => window.print(), 80)
  }

  return (
    <>
      <div className="panel">
        <div className="section-head compact duplicates-head">
          <div>
            <h3>Duplicidades</h3>
            <p>
              {reportMode === 'ANALITICO' ? (
                <>
                  {number(filtered.length)} {filtered.length === 1 ? 'grupo' : 'grupos'} no filtro atual
                  {filtered.length !== report.duplicates.length ? ' · ' + number(report.duplicates.length) + ' no total' : ''}.
                  {' '}{duplicateHint} Paginação padrão de {pageSize}.
                </>
              ) : (
                <>
                  {number(syntheticRows.length)} {syntheticRows.length === 1 ? 'grupo duplicado' : 'grupos duplicados'} no resumo sintético · {' '}
                  {number(syntheticRecordCount)} registros envolvidos · {' '}
                  {number(syntheticFieldCount)} {syntheticFieldCount === 1 ? 'campo com duplicidade' : 'campos com duplicidade'}.
                </>
              )}
            </p>
          </div>
          <div className="section-head-actions duplicates-head-actions">
            <div className="dup-report-mode" role="radiogroup" aria-label="Tipo de relatório de duplicidades">
              <label className={reportMode === 'ANALITICO' ? 'active' : ''}>
                <input
                  type="radio"
                  name="duplicate-report-mode"
                  value="ANALITICO"
                  checked={reportMode === 'ANALITICO'}
                  onChange={() => changeReportMode('ANALITICO')}
                />
                Analítico
              </label>
              <label className={reportMode === 'SINTETICO' ? 'active' : ''}>
                <input
                  type="radio"
                  name="duplicate-report-mode"
                  value="SINTETICO"
                  checked={reportMode === 'SINTETICO'}
                  onChange={() => changeReportMode('SINTETICO')}
                />
                Sintético
              </label>
            </div>
            {reportMode === 'ANALITICO' && <span className="selection-summary">{number(selectedItems.length)} selecionados</span>}
            <button
              type="button"
              className="button ghost compact-button"
              onClick={() => {
                setSearch('')
                setSideFilter('TODOS')
                setFieldFilter('TODOS')
                setDuplicateColumnFilters({ category: '', value: '', count: '', codes: '' })
              }}
            >
              Limpar filtros
            </button>
            {reportMode === 'ANALITICO' && (
              <>
                <button type="button" className="button ghost compact-button" disabled={!pageItems.length} onClick={togglePageSelection}>
                  {allPageSelected ? 'Desmarcar página' : 'Selecionar página'}
                </button>
                <button
                  type="button"
                  className="button secondary compact-button"
                  onClick={() => requestPrint(undefined, true)}
                  disabled={!selectedItems.length}
                >
                  Imprimir selecionados
                </button>
              </>
            )}
            <button
              type="button"
              className="button primary dup-print-button"
              onClick={() => requestPrint()}
              disabled={sorted.length === 0}
            >
              {reportMode === 'ANALITICO' ? 'Imprimir filtro' : 'Imprimir sintético'}
            </button>
          </div>
        </div>

        <div className="dup-analysis-note">
          <strong>{reportMode === 'ANALITICO' ? 'Como analisar' : 'Visão sintética'}</strong>
          <span>
            {reportMode === 'ANALITICO'
              ? 'Revise os registros do mesmo grupo e confirme qual cadastro deve prevalecer. Ao abrir um grupo ele é marcado como analisado para facilitar a sequência da revisão.'
              : 'Resumo compacto por grupo duplicado, mantendo lado, campo, tipo, valor, quantidade e códigos envolvidos. Os filtros ativos também são respeitados na impressão.'}
          </span>
        </div>

        <div className="dup-summary-strip" aria-label="Resumo das duplicidades filtradas">
          <div><span>Grupos duplicados</span><strong>{number(sorted.length)}</strong></div>
          <div><span>Registros envolvidos</span><strong>{number(syntheticRecordCount)}</strong></div>
          <div><span>Campos com duplicidade</span><strong>{number(syntheticFieldCount)}</strong></div>
        </div>

        <div className="table-toolbar searchable-toolbar duplicates-toolbar">
          <div className="screen-search inline-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar campo, valor, código, nome, lado ou tipo…"
              aria-label="Pesquisar duplicidades"
            />
          </div>
          <select
            className="dup-field-filter"
            value={sideFilter}
            onChange={event => setSideFilter(event.target.value as typeof sideFilter)}
            aria-label="Selecionar origem ou destino"
          >
            <option value="TODOS">Origem e destino</option>
            <option value="ORIGEM">Somente origem</option>
            <option value="DESTINO">Somente destino</option>
          </select>
          <select
            className="dup-field-filter"
            value={fieldFilter}
            onChange={event => setFieldFilter(event.target.value)}
            aria-label="Filtrar por campo duplicado"
          >
            <option value="TODOS">Todos os campos</option>
            {fieldOptions.map(([fieldId, fieldLabel]) => (
              <option key={fieldId} value={fieldId}>{fieldLabel}</option>
            ))}
          </select>
          <span className="page-size-fixed">20 por página</span>
        </div>

        {reportMode === 'ANALITICO' ? (
          <div className="table-wrap stable-filter-table-wrap">
            <table className="dup-table analytic-report-table">
            <thead>
              <tr>
                <th className="selection-column"><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Selecionar página" /></th>
                <SortableHeader label="Lado" sortKey="side" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Campo duplicado" sortKey="field" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Tipo" sortKey="category" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Valor duplicado" sortKey="value" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Qtd. registros" sortKey="count" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <SortableHeader label="Códigos envolvidos" sortKey="codes" sort={sort} onSort={key => setSort(current => nextSort(current, key))} />
                <th>Análise</th>
                <th>Ações</th>
              </tr>
              <tr className="column-filter-row">
                <th />
                <th>
                  <select value={sideFilter} onChange={event => setSideFilter(event.target.value as typeof sideFilter)}>
                    <option value="TODOS">Todos</option>
                    <option value="ORIGEM">Origem</option>
                    <option value="DESTINO">Destino</option>
                  </select>
                </th>
                <th>
                  <select value={fieldFilter} onChange={event => setFieldFilter(event.target.value)}>
                    <option value="TODOS">Todos os campos</option>
                    {fieldOptions.map(([fieldId, fieldLabel]) => (
                      <option key={fieldId} value={fieldId}>{fieldLabel}</option>
                    ))}
                  </select>
                </th>
                <th><input value={duplicateColumnFilters.category} onChange={event => setDuplicateColumnFilters(current => ({ ...current, category: event.target.value }))} placeholder="Tipo…" /></th>
                <th><input value={duplicateColumnFilters.value} onChange={event => setDuplicateColumnFilters(current => ({ ...current, value: event.target.value }))} placeholder="Valor…" /></th>
                <th><input value={duplicateColumnFilters.count} onChange={event => setDuplicateColumnFilters(current => ({ ...current, count: event.target.value }))} placeholder="Qtd." /></th>
                <th><input value={duplicateColumnFilters.codes} onChange={event => setDuplicateColumnFilters(current => ({ ...current, codes: event.target.value }))} placeholder="Código…" /></th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((dup, index) => {
                const rowId = rowIdOf(dup)
                const field = profile.fields.find(item => item.id === dup.fieldId)
                const monoValue = field ? monoKinds.has(field.kind) : true
                const open = openGroups.has(rowId)
                const reviewed = reviewedGroups.has(rowId)
                return (
                  <Fragment key={rowId + '-' + index}>
                    <tr className={[
                      'dup-group-row',
                      open ? 'is-open' : '',
                      reviewed ? 'row-reviewed' : '',
                    ].filter(Boolean).join(' ')}>
                      <td className="selection-column">
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(rowId)}
                          onChange={() => setSelectedGroups(current => toggleSet(current, rowId))}
                        />
                      </td>
                      <td>
                        <span className={'dup-side dup-side-' + dup.side.toLowerCase()}>{dup.side}</span>
                      </td>
                      <td>
                        <div className="dup-field">
                          <strong>{dup.fieldLabel}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="dup-category">{dup.category}</span>
                      </td>
                      <td>
                        <div className="dup-value">
                          <span>Valor duplicado</span>
                          <strong className={monoValue ? 'mono' : undefined}>{dup.normalizedValue || '—'}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="dup-count">
                          <strong>{number(dup.count)}</strong>
                          <span>{dup.count === 1 ? 'registro' : 'registros'}</span>
                        </span>
                      </td>
                      <td>
                        <DuplicateCodeList
                          codes={dup.records.map(record => record.key)}
                          expanded={expandedCodes.has(rowId)}
                          onToggle={() => setExpandedCodes(current => toggleSet(current, rowId))}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={'review-chip ' + (reviewed ? 'done' : '')}
                          onClick={() => setReviewedGroups(current => toggleSet(current, rowId))}
                        >
                          {reviewed ? '✓ Analisado' : 'Marcar analisado'}
                        </button>
                      </td>
                      <td>
                        <div className="dup-actions">
                          <button
                            type="button"
                            className="button ghost compact-button"
                            onClick={() => toggleGroup(rowId)}
                            aria-expanded={open}
                          >
                            {open ? 'Ocultar' : 'Ver registros'}
                          </button>
                          <button
                            type="button"
                            className="dup-print-group"
                            onClick={() => requestPrint(rowId)}
                            aria-label={'Imprimir grupo duplicado de ' + dup.fieldLabel}
                          >
                            Imprimir grupo
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="dup-expand-row">
                        <td colSpan={9}>
                          <DuplicateGroupDetails
                            groupId={rowId}
                            fieldId={dup.fieldId}
                            fieldLabel={dup.fieldLabel}
                            normalizedValue={dup.normalizedValue}
                            nameLabel={nameLabel}
                            records={dup.records}
                            codesExpanded={expandedCodes.has(rowId + '::details')}
                            onToggleCodes={() => setExpandedCodes(current => toggleSet(current, rowId + '::details'))}
                            recordsExpanded={expandedRecords.has(rowId)}
                            onToggleRecords={() => setExpandedRecords(current => toggleSet(current, rowId))}
                            monoValue={monoValue}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap stable-filter-table-wrap">
            <table className="dup-table dup-synthetic-table analytic-report-table">
              <thead>
                <tr>
                  <th>Lado</th>
                  <th>Campo duplicado</th>
                  <th>Tipo</th>
                  <th>Valor duplicado</th>
                  <th>Qtd. registros</th>
                  <th>Códigos envolvidos</th>
                </tr>
              </thead>
              <tbody>
                {syntheticPageItems.map(row => (
                  <tr key={row.key}>
                    <td><span className={'dup-side dup-side-' + row.side.toLowerCase()}>{row.side}</span></td>
                    <td><div className="dup-field"><strong>{row.fieldLabel}</strong></div></td>
                    <td><span className="dup-category">{row.category}</span></td>
                    <td><strong className="mono dup-synthetic-value">{row.normalizedValue || '—'}</strong></td>
                    <td><strong className="dup-synthetic-number">{number(row.recordCount)}</strong></td>
                    <td><span className="dup-synthetic-codes">{row.codes.length ? row.codes.join(' · ') : '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={safePage} pages={pages} onChange={setPage} />
      </div>

      {reportMode === 'ANALITICO' ? (
        <DuplicatePrintReport
          items={printItems}
          profile={profile}
          filterDescription={filterDescription}
          generatedAt={report.generatedAt}
        />
      ) : (
        <DuplicateSyntheticPrintReport
          rows={syntheticRows}
          sourceItems={sorted}
          profile={profile}
          filterDescription={filterDescription}
          generatedAt={report.generatedAt}
        />
      )}
    </>
  )
}

function MissingView({
  report,
  profile,
  onOpenClient,
}: {
  report: ComparisonReport
  profile: EntityProfile
  onOpenClient: (client: ClientComparison) => void
}) {
  const pageSize = 20
  const [originPage, setOriginPage] = useState(1)
  const [targetPage, setTargetPage] = useState(1)
  const [search, setSearch] = useState('')
  const [originSort, setOriginSort] = useState<SortState>({ key: 'code', direction: 'asc' })
  const [targetSort, setTargetSort] = useState<SortState>({ key: 'code', direction: 'asc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [printSelected, setPrintSelected] = useState(false)
  const [originFilters, setOriginFilters] = useState({
    code: '',
    name: '',
    inactive: 'TODOS',
    status: 'TODOS',
  })
  const [targetFilters, setTargetFilters] = useState({
    code: '',
    name: '',
  })

  const term = search.trim().toLocaleUpperCase('pt-BR')
  const contains = (value: unknown, filter: string) =>
    !filter.trim() || String(value ?? '').toLocaleUpperCase('pt-BR').includes(filter.trim().toLocaleUpperCase('pt-BR'))

  const missing = useMemo(() => report.clients.filter(client => !client.found).filter(client => {
    if (!contains(client.key, originFilters.code)) return false
    if (!contains(client.name, originFilters.name)) return false
    if (originFilters.inactive === 'SIM' && !client.originInactive) return false
    if (originFilters.inactive === 'NAO' && client.originInactive) return false
    if (originFilters.status !== 'TODOS' && client.status !== originFilters.status) return false
    if (!term) return true
    const raw = Object.values(client.originRow).join(' ')
    return (client.key + ' ' + client.name + ' ' + client.status + ' ' + raw).toLocaleUpperCase('pt-BR').includes(term)
  }), [report.clients, search, originFilters])

  const targetOnly = useMemo(() => report.targetOnly.filter(client => {
    if (!contains(client.key, targetFilters.code)) return false
    if (!contains(client.name, targetFilters.name)) return false
    if (!term) return true
    return (client.key + ' ' + client.name + ' ' + Object.values(client.row).join(' ')).toLocaleUpperCase('pt-BR').includes(term)
  }), [report.targetOnly, search, targetFilters])

  const sortedMissing = useMemo(() => sortedBy(missing, originSort, (client, key) => {
    if (key === 'code') return client.key
    if (key === 'name') return client.name
    if (key === 'inactive') return client.originInactive
    if (key === 'status') return client.status
    return ''
  }), [missing, originSort])

  const sortedTargetOnly = useMemo(() => sortedBy(targetOnly, targetSort, (client, key) => {
    if (key === 'code') return client.key
    if (key === 'name') return client.name
    return ''
  }), [targetOnly, targetSort])

  const originPages = Math.max(1, Math.ceil(sortedMissing.length / pageSize))
  const targetPages = Math.max(1, Math.ceil(sortedTargetOnly.length / pageSize))
  const originItems = sortedMissing.slice((originPage - 1) * pageSize, originPage * pageSize)
  const targetItems = sortedTargetOnly.slice((targetPage - 1) * pageSize, targetPage * pageSize)

  const originId = (key: string) => 'ORIGEM::' + key
  const targetId = (key: string) => 'DESTINO::' + key
  const visibleIds = [
    ...originItems.map(client => originId(client.key)),
    ...targetItems.map(client => targetId(client.key)),
  ]
  const selectedCount = [...selected].filter(id =>
    sortedMissing.some(client => originId(client.key) === id)
    || sortedTargetOnly.some(client => targetId(client.key) === id),
  ).length
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))

  useEffect(() => {
    setOriginPage(1)
    setTargetPage(1)
  }, [
    search,
    originSort.key,
    originSort.direction,
    targetSort.key,
    targetSort.direction,
    originFilters,
    targetFilters,
  ])

  const clearFilters = () => {
    setSearch('')
    setOriginFilters({ code: '', name: '', inactive: 'TODOS', status: 'TODOS' })
    setTargetFilters({ code: '', name: '' })
  }

  const toggleVisible = () => {
    setSelected(current => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  const requestPrint = (onlySelected: boolean) => {
    setPrintSelected(onlySelected)
    window.setTimeout(() => window.print(), 80)
  }

  const sourceMissing = printSelected
    ? sortedMissing.filter(client => selected.has(originId(client.key)))
    : sortedMissing
  const sourceTarget = printSelected
    ? sortedTargetOnly.filter(client => selected.has(targetId(client.key)))
    : sortedTargetOnly

  const printRows = [
    ...sourceMissing.map(client => ({
      tipo: 'Origem não localizada',
      codigo: client.key,
      registro: client.name || '—',
      detalhe: client.originInactive ? 'Origem inativa: Sim' : 'Origem inativa: Não',
      resultado: client.status,
      analisado: reviewed.has(originId(client.key)) ? 'Sim' : 'Não',
    })),
    ...sourceTarget.map(client => ({
      tipo: 'Somente no destino',
      codigo: client.key,
      registro: client.name || '—',
      detalhe: 'Registro presente apenas no destino',
      resultado: 'DESTINO',
      analisado: reviewed.has(targetId(client.key)) ? 'Sim' : 'Não',
    })),
  ]

  return (
    <>
      <div className="missing-view">
        <div className="table-toolbar searchable-toolbar missing-toolbar">
          <div className="screen-search inline-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar em todos os dados não localizados…"
              aria-label="Pesquisar registros não importados"
            />
          </div>
          <span className="selection-summary">{selectedCount.toLocaleString('pt-BR')} selecionados</span>
          <button type="button" className="button ghost compact-button" onClick={clearFilters}>Limpar filtros</button>
          <button type="button" className="button ghost compact-button" disabled={!visibleIds.length} onClick={toggleVisible}>
            {allVisibleSelected ? 'Desmarcar páginas' : 'Selecionar páginas'}
          </button>
          <button type="button" className="button secondary compact-button" disabled={!selectedCount} onClick={() => requestPrint(true)}>
            Imprimir selecionados
          </button>
          <button type="button" className="button primary compact-button" disabled={!sortedMissing.length && !sortedTargetOnly.length} onClick={() => requestPrint(false)}>
            Imprimir filtro
          </button>
          <span className="page-size-fixed">20 por página</span>
        </div>

        <div className="two-panels">
          <section className="panel">
            <div className="section-head compact">
              <div>
                <h3>Origem não localizada no destino</h3>
                <p>{number(sortedMissing.length)} registros.</p>
              </div>
            </div>
            <div className="table-wrap stable-filter-table-wrap">
              <table className="missing-table analytic-report-table">
                <thead>
                  <tr>
                    <th className="selection-column" />
                    <SortableHeader label="Código" sortKey="code" sort={originSort} onSort={key => setOriginSort(current => nextSort(current, key))} />
                    <SortableHeader label={profile.recordLabel} sortKey="name" sort={originSort} onSort={key => setOriginSort(current => nextSort(current, key))} />
                    <SortableHeader label="Origem inativa" sortKey="inactive" sort={originSort} onSort={key => setOriginSort(current => nextSort(current, key))} />
                    <SortableHeader label="Resultado" sortKey="status" sort={originSort} onSort={key => setOriginSort(current => nextSort(current, key))} />
                    <th>Análise</th>
                    <th>Ação</th>
                  </tr>
                  <tr className="column-filter-row">
                    <th />
                    <th><input value={originFilters.code} onChange={e => setOriginFilters(current => ({ ...current, code: e.target.value }))} placeholder="Código…" /></th>
                    <th><input value={originFilters.name} onChange={e => setOriginFilters(current => ({ ...current, name: e.target.value }))} placeholder="Registro…" /></th>
                    <th>
                      <select value={originFilters.inactive} onChange={e => setOriginFilters(current => ({ ...current, inactive: e.target.value }))}>
                        <option value="TODOS">Todos</option>
                        <option value="SIM">Sim</option>
                        <option value="NAO">Não</option>
                      </select>
                    </th>
                    <th>
                      <select value={originFilters.status} onChange={e => setOriginFilters(current => ({ ...current, status: e.target.value }))}>
                        <option value="TODOS">Todos</option>
                        <option value="DIVERGENTE">Divergente</option>
                        <option value="ATENÇÃO">Atenção</option>
                        <option value="NÃO IMPORTADO">Não importado</option>
                      </select>
                    </th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {originItems.map(client => {
                    const id = originId(client.key)
                    const isReviewed = reviewed.has(id)
                    return (
                      <tr key={client.key} className={isReviewed ? 'row-reviewed' : ''}>
                        <td className="selection-column">
                          <input type="checkbox" checked={selected.has(id)} onChange={() => setSelected(current => toggleStringSet(current, id))} />
                        </td>
                        <td className="mono">{client.key}</td>
                        <td>{client.name || '—'}</td>
                        <td>{client.originInactive ? 'Sim' : 'Não'}</td>
                        <td><StatusBadge status={client.status} /></td>
                        <td>
                          <button type="button" className={'review-chip ' + (isReviewed ? 'done' : '')} onClick={() => setReviewed(current => toggleStringSet(current, id))}>
                            {isReviewed ? '✓ Analisado' : 'Marcar analisado'}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="analysis-action-button"
                            onClick={() => {
                              setReviewed(current => new Set(current).add(id))
                              onOpenClient(client)
                            }}
                          >
                            Abrir análise
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={originPage} pages={originPages} onChange={setOriginPage} />
          </section>

          <section className="panel">
            <div className="section-head compact">
              <div>
                <h3>Somente no destino</h3>
                <p>{number(sortedTargetOnly.length)} registros.</p>
              </div>
            </div>
            <div className="table-wrap stable-filter-table-wrap">
              <table className="missing-table analytic-report-table">
                <thead>
                  <tr>
                    <th className="selection-column" />
                    <SortableHeader label="Código" sortKey="code" sort={targetSort} onSort={key => setTargetSort(current => nextSort(current, key))} />
                    <SortableHeader label={profile.recordLabel} sortKey="name" sort={targetSort} onSort={key => setTargetSort(current => nextSort(current, key))} />
                    <th>Análise</th>
                  </tr>
                  <tr className="column-filter-row">
                    <th />
                    <th><input value={targetFilters.code} onChange={e => setTargetFilters(current => ({ ...current, code: e.target.value }))} placeholder="Código…" /></th>
                    <th><input value={targetFilters.name} onChange={e => setTargetFilters(current => ({ ...current, name: e.target.value }))} placeholder="Registro…" /></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {targetItems.map(client => {
                    const id = targetId(client.key)
                    const isReviewed = reviewed.has(id)
                    return (
                      <tr key={client.key} className={isReviewed ? 'row-reviewed' : ''}>
                        <td className="selection-column">
                          <input type="checkbox" checked={selected.has(id)} onChange={() => setSelected(current => toggleStringSet(current, id))} />
                        </td>
                        <td className="mono">{client.key}</td>
                        <td>{client.name || '—'}</td>
                        <td>
                          <button type="button" className={'review-chip ' + (isReviewed ? 'done' : '')} onClick={() => setReviewed(current => toggleStringSet(current, id))}>
                            {isReviewed ? '✓ Analisado' : 'Marcar analisado'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={targetPage} pages={targetPages} onChange={setTargetPage} />
          </section>
        </div>
      </div>

      <DataPrintReport
        title="Registros não localizados"
        subtitle={profile.label + ' · origem não localizada e registros somente no destino'}
        filterDescription={[
          search.trim() ? 'Pesquisa: ' + search.trim() : '',
          originFilters.code ? 'Código origem: ' + originFilters.code : '',
          originFilters.name ? profile.recordLabel + ' origem: ' + originFilters.name : '',
          originFilters.status !== 'TODOS' ? 'Resultado: ' + originFilters.status : '',
          targetFilters.code ? 'Código destino: ' + targetFilters.code : '',
          targetFilters.name ? profile.recordLabel + ' destino: ' + targetFilters.name : '',
          printSelected ? 'Somente registros selecionados' : 'Resultado filtrado',
        ].filter(Boolean).join(' · ')}
        columns={[
          { key: 'tipo', label: 'Tipo' },
          { key: 'codigo', label: 'Código' },
          { key: 'registro', label: profile.recordLabel },
          { key: 'detalhe', label: 'Detalhe' },
          { key: 'resultado', label: 'Resultado' },
          { key: 'analisado', label: 'Analisado' },
        ]}
        rows={printRows}
      />
    </>
  )
}

export default App
