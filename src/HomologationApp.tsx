import { useEffect, useMemo, useState } from 'react'
import FileDropZone from './components/FileDropZone'
import MappingPanel from './components/MappingPanel'
import ClientDrawer from './components/ClientDrawer'
import StatusBadge from './components/StatusBadge'
import { ENTITY_PROFILES, detectEntityProfile, getEntityProfile } from './config/entities'
import { buildDataset } from './lib/files'
import { autoMap, mappingCoverage } from './lib/mapping'
import { applyManualFieldAdjustment, compareDatasets, revertManualFieldAdjustment } from './lib/compare'
import { exportClientsCsv, exportReportExcel } from './lib/exporters'
import { validateCpfCnpj } from './lib/normalizers'
import type { ClientComparison, ComparisonReport, EntityProfile, FieldMapping, ImportedFile, Severity } from './types'

type Tab = 'overview' | 'clients' | 'issues' | 'fields' | 'duplicates' | 'missing'
type EntityMode = 'auto' | string

const number = (value: number) => value.toLocaleString('pt-BR')
const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(2).replace('.', ',')}%` : '—'
const plural = (profile: EntityProfile) => profile.label

function App() {
  const [originFiles, setOriginFiles] = useState<ImportedFile[]>([])
  const [targetFiles, setTargetFiles] = useState<ImportedFile[]>([])
  const origin = useMemo(() => buildDataset(originFiles), [originFiles])
  const target = useMemo(() => buildDataset(targetFiles), [targetFiles])
  const [entityMode, setEntityMode] = useState<EntityMode>('auto')
  const [mapping, setMapping] = useState<FieldMapping[]>([])
  const [report, setReport] = useState<ComparisonReport | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedClient, setSelectedClient] = useState<ClientComparison | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | Severity>('TODOS')
  const [issueFieldFilter, setIssueFieldFilter] = useState('TODOS')
  const [focusedFieldId, setFocusedFieldId] = useState<string | undefined>()
  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

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
    () => getEntityProfile(entityMode === 'auto' ? detection.profileId : entityMode),
    [detection.profileId, entityMode],
  )
  const conservativeMapping = entityMode === 'auto' && detection.lowConfidence

  useEffect(() => {
    if (origin.headers.length && target.headers.length) {
      setMapping(autoMap(origin, target, profile, { allowGenericHeaders: !conservativeMapping }))
      setReport(null)
    } else {
      setMapping([])
      setReport(null)
    }
  }, [origin.headers.join('|'), target.headers.join('|'), profile.id, conservativeMapping])

  useEffect(() => setPage(1), [search, statusFilter, issueFieldFilter, activeTab, pageSize])

  const coverage = useMemo(() => mappingCoverage(mapping), [mapping])
  const keyMapping = mapping.find(m => m.fieldId === 'codigoInterno')
  const ready = origin.rows.length > 0 && target.rows.length > 0 && Boolean(keyMapping?.originHeader && keyMapping?.targetHeader)
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'clients', label: plural(profile) },
    { id: 'issues', label: 'Divergências' },
    { id: 'fields', label: 'Por campo' },
    { id: 'duplicates', label: 'Duplicidades' },
    { id: 'missing', label: 'Não importados' },
  ]

  const remap = () => {
    setMapping(autoMap(origin, target, profile, { allowGenericHeaders: !conservativeMapping }))
    setReport(null)
  }

  const runComparison = () => {
    setBusy(true)
    setError('')
    window.setTimeout(() => {
      try {
        const next = compareDatasets(origin, target, mapping, profile)
        setReport(next)
        setActiveTab('overview')
        setIssueFieldFilter('TODOS')
        setStatusFilter('TODOS')
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

  const filteredClients = useMemo(() => {
    if (!report) return []
    const term = search.trim().toLocaleUpperCase('pt-BR')
    return report.clients.filter(client => {
      if (statusFilter !== 'TODOS' && client.status !== statusFilter) return false
      if (!term) return true
      const fieldHit = client.fields.some(field => `${field.originValue} ${field.targetValue}`.toLocaleUpperCase('pt-BR').includes(term))
      return client.key.toLocaleUpperCase('pt-BR').includes(term) || client.name.toLocaleUpperCase('pt-BR').includes(term) || fieldHit
    })
  }, [report, search, statusFilter])

  const issues = useMemo(() => {
    if (!report) return []
    const term = search.trim().toLocaleUpperCase('pt-BR')
    const restrictField = issueFieldFilter !== 'TODOS'
    return report.clients.flatMap(client => {
      if (restrictField && !client.found) return []
      return client.fields
        .filter(field => field.status === 'DIVERGENTE' || field.status === 'ATENÇÃO')
        .map(field => ({ client, field }))
    }).filter(item => {
      if (restrictField && item.field.fieldId !== issueFieldFilter) return false
      if (statusFilter !== 'TODOS' && item.field.status !== statusFilter) return false
      if (!term) return true
      const text = `${item.client.key} ${item.client.name} ${item.field.fieldLabel} ${item.field.originValue} ${item.field.targetValue} ${item.field.reason}`.toLocaleUpperCase('pt-BR')
      return text.includes(term)
    })
  }, [report, search, statusFilter, issueFieldFilter])

  const pageSlice = <T,>(items: T[]) => items.slice((page - 1) * pageSize, page * pageSize)
  const pageCount = (items: unknown[]) => Math.max(1, Math.ceil(items.length / pageSize))
  const resultProfile = report ? getEntityProfile(report.profileId) : profile
  const showDocument = resultProfile.showDocumentValidity === true

  const clearAll = () => {
    setOriginFiles([])
    setTargetFiles([])
    setMapping([])
    setReport(null)
    setSelectedClient(null)
    setSearch('')
    setStatusFilter('TODOS')
    setIssueFieldFilter('TODOS')
    setFocusedFieldId(undefined)
    setSelectedOccurrenceKey(null)
    setEntityMode('auto')
  }

  const openFieldAnalysis = (fieldId: string, status: 'TODOS' | 'DIVERGENTE' | 'ATENÇÃO') => {
    setIssueFieldFilter(fieldId)
    setStatusFilter(status)
    setSearch('')
    setPage(1)
    setActiveTab('issues')
  }

  const backToFields = () => {
    setActiveTab('fields')
    setIssueFieldFilter('TODOS')
    setStatusFilter('TODOS')
    setSearch('')
    setPage(1)
  }

  const clearIssueFieldFilter = () => {
    setIssueFieldFilter('TODOS')
    setPage(1)
  }

  const openRecord = (client: ClientComparison, fieldId?: string, occurrenceKey?: string) => {
    setSelectedClient(client)
    setFocusedFieldId(fieldId ?? (issueFieldFilter !== 'TODOS' ? issueFieldFilter : undefined))
    setSelectedOccurrenceKey(occurrenceKey ?? null)
  }

  const occurrenceKeyOf = (clientKey: string, fieldId: string) => `${clientKey}::${fieldId}`
  const occurrenceIndex = selectedOccurrenceKey
    ? issues.findIndex(item => occurrenceKeyOf(item.client.key, item.field.fieldId) === selectedOccurrenceKey)
    : -1
  const goToOccurrence = (index: number) => {
    const item = issues[index]
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
    ? `${number(issues.length)} ${issues.length === 1 ? 'divergência encontrada' : 'divergências encontradas'}`
    : statusFilter === 'ATENÇÃO'
      ? `${number(issues.length)} ${issues.length === 1 ? 'atenção encontrada' : 'atenções encontradas'}`
      : `${number(issues.length)} ${issues.length === 1 ? 'ocorrência para revisão' : 'ocorrências para revisão'}`
  const drawerFocusedFieldId = focusedFieldId ?? (issueFieldFilter !== 'TODOS' ? issueFieldFilter : undefined)
  const occurrenceNav = selectedClient && occurrenceIndex >= 0 && issues.length > 0
    ? {
        current: occurrenceIndex,
        total: issues.length,
        onPrev: () => goToOccurrence(occurrenceIndex - 1),
        onNext: () => goToOccurrence(occurrenceIndex + 1),
      }
    : undefined

  const hasFiles = origin.headers.length > 0 || target.headers.length > 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="module-topbar-title">
          <strong>Homologação</strong>
          <span>Importação, vínculo e comparação de dados</span>
        </div>
        <div className="topbar-actions">
          <div className="privacy-pill"><span>●</span> Processamento local no navegador</div>
          {(originFiles.length > 0 || targetFiles.length > 0) && <button className="button ghost" onClick={clearAll}>Limpar análise</button>}
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
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
        </section>

        {!report && (
          <>
            <div className="privacy-banner">
              <strong>Seus dados não são enviados para banco de dados.</strong>
              <span>Os arquivos ficam somente na memória da aba enquanto a análise estiver aberta.</span>
            </div>

            <section className="entity-type-card">
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
            </section>

            <section className="import-grid">
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
            </section>

            {(origin.rows.length > 0 || target.rows.length > 0) && (
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
                onChange={setMapping}
                onAutoMap={remap}
              />
            )}

            {error && <div className="global-error">{error}</div>}

            <div className="run-bar">
              <div>
                <strong>{ready ? `Pronto para homologar ${profile.label.toLowerCase()}.` : 'Importe os dois lados e confirme a chave Código interno.'}</strong>
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

            <nav className="tabs">
              {tabs.map(tab => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </nav>

            {activeTab !== 'overview' && activeTab !== 'fields' && activeTab !== 'duplicates' && activeTab !== 'missing' && (
              <div className={`filters${activeTab === 'issues' ? ' filters-issues' : ''}`}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Pesquisar código, ${resultProfile.recordLabel.toLowerCase()} ou qualquer valor…`} />
                {activeTab === 'issues' && (
                  <select
                    value={issueFieldFilter}
                    onChange={e => setIssueFieldFilter(e.target.value)}
                    aria-label="Filtrar por campo"
                  >
                    <option value="TODOS">Todos os campos</option>
                    {report.fieldSummary.map(field => (
                      <option key={field.fieldId} value={field.fieldId}>{field.fieldLabel}</option>
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
                <PageSizeSelect value={pageSize} onChange={setPageSize} />
              </div>
            )}

            {activeTab === 'overview' && <Overview report={report} profile={resultProfile} onOpenClient={client => openRecord(client)} />}
            {activeTab === 'clients' && (
              <div className="panel">
                <div className="section-head compact"><div><h3>{resultProfile.label}</h3><p>{number(filteredClients.length)} registros no filtro atual.</p></div><button className="button ghost" onClick={() => exportClientsCsv(filteredClients, `primecheck_${resultProfile.id}.csv`, resultProfile.recordLabel)}>Exportar CSV filtrado</button></div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>{resultProfile.recordLabel}</th>
                        <th>Encontrado</th>
                        <th>Resultado</th>
                        <th>Divergências</th>
                        <th>Atenções</th>
                        {showDocument && <th>CPF/CNPJ origem</th>}
                        {showDocument && <th>Validade</th>}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice(filteredClients).map(client => {
                        const doc = client.fields.find(f => f.fieldId === 'cpfCnpj')?.originValue ?? ''
                        const validation = validateCpfCnpj(doc)
                        return <tr key={client.key}>
                          <td className="mono">{client.key}</td>
                          <td><strong>{client.name || '—'}</strong></td>
                          <td>{client.found ? 'Sim' : 'Não'}</td>
                          <td><StatusBadge status={client.status} /></td>
                          <td>{client.divergentCount}</td>
                          <td>{client.attentionCount}</td>
                          {showDocument && <td className="mono">{doc || '—'}</td>}
                          {showDocument && <td><span className={`validity ${validation.status === 'VÁLIDO' ? 'valid' : 'warn'}`}>{validation.status}</span></td>}
                          <td><button type="button" className="link-button" onClick={() => openRecord(client)}>Analisar</button></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pages={pageCount(filteredClients)} onChange={setPage} />
              </div>
            )}

            {activeTab === 'issues' && (
              <div className="panel">
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
                <div className="section-head compact"><div><h3>Divergências e atenções</h3><p>{number(issues.length)} ocorrências no filtro atual.</p></div></div>
                {issues.length === 0 ? (
                  <div className="empty-state">Nenhuma ocorrência no filtro atual.</div>
                ) : (
                <>
                <div className="table-wrap">
                  <table className={fieldAnalysis ? 'issues-table issues-table-focused' : 'issues-table'}>
                    <thead><tr><th>Código</th><th>{resultProfile.recordLabel}</th><th>Campo</th><th>Origem</th><th>Destino</th><th>Status</th><th>Motivo</th><th>Ação</th></tr></thead>
                    <tbody>
                      {pageSlice(issues).map((item, idx) => {
                        const occurrenceKey = occurrenceKeyOf(item.client.key, item.field.fieldId)
                        const highlight = issueFieldFilter !== 'TODOS'
                        return (
                          <tr key={`${item.client.key}-${item.field.fieldId}-${idx}`}>
                            <td className="mono">{item.client.key}</td>
                            <td>
                              <button
                                type="button"
                                className="link-button left"
                                onClick={() => openRecord(item.client, item.field.fieldId, occurrenceKey)}
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
                              <IssueValueCell label="Origem" value={item.field.originValue} status={item.field.status} highlight={highlight} />
                            </td>
                            <td>
                              <IssueValueCell label="Destino" value={item.field.targetValue} status={item.field.status} highlight={highlight} />
                            </td>
                            <td><StatusBadge status={item.field.status} /></td>
                            <td className="reason-cell">{item.field.reason}</td>
                            <td>
                              <button
                                type="button"
                                className="button secondary compact-button"
                                onClick={() => openRecord(item.client, item.field.fieldId, occurrenceKey)}
                              >
                                Analisar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pages={pageCount(issues)} onChange={setPage} />
                </>
                )}
              </div>
            )}

            {activeTab === 'fields' && <FieldSummaryView report={report} onAnalyzeField={openFieldAnalysis} />}
            {activeTab === 'duplicates' && <DuplicatesView report={report} profile={resultProfile} />}
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
  const critical = report.clients.filter(c => c.status === 'DIVERGENTE').sort((a,b) => b.divergentCount - a.divergentCount).slice(0, 8)
  const cpfField = report.fieldSummary.find(f => f.fieldId === 'cpfCnpj')
  const worstFields = [...report.fieldSummary].filter(f => f.divergent || f.attention).sort((a,b) => (b.divergent * 2 + b.attention) - (a.divergent * 2 + a.attention)).slice(0, 8)
  return <div className="overview-grid">
    <section className="panel">
      <div className="section-head compact"><div><h3>Campos que mais exigem revisão</h3><p>Priorizados por divergência e atenção.</p></div></div>
      <div className="field-ranking">
        {worstFields.map(field => <div className="rank-row" key={field.fieldId}>
          <div><strong>{field.fieldLabel}</strong><span>{field.group}</span></div>
          <div className="rank-metrics"><span className="metric-error">{field.divergent} erros</span><span className="metric-warning">{field.attention} avisos</span><strong>{field.conformityPercent === null ? '—' : `${field.conformityPercent.toFixed(1)}%`}</strong></div>
        </div>)}
      </div>
    </section>
    <section className="panel">
      <div className="section-head compact"><div><h3>Registros prioritários</h3><p>{profile.label} com maior quantidade de divergências.</p></div></div>
      <div className="priority-list">
        {critical.map(client => <button key={client.key} onClick={() => onOpenClient(client)}><span className="mono">{client.key}</span><div><strong>{client.name || 'Sem descrição'}</strong><small>{client.divergentCount} divergências · {client.attentionCount} atenções</small></div><span>→</span></button>)}
        {!critical.length && <div className="empty-state">Nenhum registro divergente. Excelente resultado.</div>}
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
}

function IssueValueCell({
  label,
  value,
  status,
  highlight,
}: {
  label: string
  value: string
  status: Severity
  highlight: boolean
}) {
  const tone = highlight
    ? status === 'DIVERGENTE'
      ? 'issue-value-divergent'
      : status === 'ATENÇÃO'
        ? 'issue-value-attention'
        : ''
    : ''

  return (
    <div className={`issue-value ${tone}`.trim()}>
      <small>{label}</small>
      <strong>{value || '—'}</strong>
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
  return (
    <div className="panel">
      <div className="section-head compact">
        <div>
          <h3>Comparação por campo</h3>
          <p>Resumo completo do perfil de homologação. Clique no campo ou na quantidade para analisar as ocorrências.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Campo</th>
              <th>Conformes</th>
              <th>Divergentes</th>
              <th>Atenções</th>
              <th>Não validáveis</th>
              <th>% conformidade</th>
            </tr>
          </thead>
          <tbody>
            {report.fieldSummary.map(field => {
              const reviewCount = field.divergent + field.attention
              return (
                <tr key={field.fieldId}>
                  <td className="muted-cell">{field.group}</td>
                  <td>
                    {reviewCount > 0 ? (
                      <button
                        type="button"
                        className="field-analysis-link"
                        onClick={() => onAnalyzeField(field.fieldId, 'TODOS')}
                        title={`Ver ${number(reviewCount)} ocorrências de ${field.fieldLabel}`}
                        aria-label={`Ver ${number(reviewCount)} ocorrências de ${field.fieldLabel}`}
                      >
                        {field.fieldLabel}
                      </button>
                    ) : (
                      <strong>{field.fieldLabel}</strong>
                    )}
                  </td>
                  <td>{number(field.conform)}</td>
                  <td className="text-error">
                    {field.divergent > 0 ? (
                      <button
                        type="button"
                        className="issue-count-link issue-count-link-divergent"
                        onClick={() => onAnalyzeField(field.fieldId, 'DIVERGENTE')}
                        title={`Ver ${number(field.divergent)} divergências de ${field.fieldLabel}`}
                        aria-label={`Ver ${number(field.divergent)} divergências de ${field.fieldLabel}`}
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
                        onClick={() => onAnalyzeField(field.fieldId, 'ATENÇÃO')}
                        title={`Ver ${number(field.attention)} atenções de ${field.fieldLabel}`}
                        aria-label={`Ver ${number(field.attention)} atenções de ${field.fieldLabel}`}
                      >
                        {number(field.attention)}
                      </button>
                    ) : number(field.attention)}
                  </td>
                  <td>{number(field.notValidatable)}</td>
                  <td>
                    <strong>{field.conformityPercent === null ? '—' : `${field.conformityPercent.toFixed(2).replace('.', ',')}%`}</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DuplicatesView({ report, profile }: { report: ComparisonReport; profile: EntityProfile }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => setPage(1), [pageSize])

  const pages = Math.max(1, Math.ceil(report.duplicates.length / pageSize))
  const pageItems = report.duplicates.slice((page - 1) * pageSize, page * pageSize)
  const duplicateHint = profile.showDocumentValidity
    ? 'grupos duplicados em CPF/CNPJ ou IE.'
    : 'grupos duplicados nos campos de unicidade do perfil.'

  return (
    <div className="panel">
      <div className="section-head compact">
        <div>
          <h3>Duplicidades</h3>
          <p>{number(report.duplicates.length)} {duplicateHint}</p>
        </div>
        <PageSizeSelect value={pageSize} onChange={setPageSize} />
      </div>

      {report.duplicates.length === 0 ? (
        <div className="empty-state">Nenhuma duplicidade identificada nos campos mapeados.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Lado</th><th>Campo</th><th>Valor</th><th>Qtd.</th><th>Registros envolvidos</th></tr>
              </thead>
              <tbody>
                {pageItems.map((dup, i) => (
                  <tr key={`${dup.side}-${dup.fieldId}-${dup.normalizedValue}-${i}`}>
                    <td><strong>{dup.side}</strong></td>
                    <td>{dup.fieldLabel}</td>
                    <td className="mono">{dup.normalizedValue}</td>
                    <td>{dup.count}</td>
                    <td>{dup.records.map(r => `${r.key}${r.name ? ` · ${r.name}` : ''}`).join(' | ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
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
  const [pageSize, setPageSize] = useState(20)
  const [originPage, setOriginPage] = useState(1)
  const [targetPage, setTargetPage] = useState(1)

  const missing = report.clients.filter(client => !client.found)
  const originPages = Math.max(1, Math.ceil(missing.length / pageSize))
  const targetPages = Math.max(1, Math.ceil(report.targetOnly.length / pageSize))
  const originItems = missing.slice((originPage - 1) * pageSize, originPage * pageSize)
  const targetItems = report.targetOnly.slice((targetPage - 1) * pageSize, targetPage * pageSize)

  useEffect(() => {
    setOriginPage(1)
    setTargetPage(1)
  }, [pageSize])

  return (
    <div className="missing-view">
      <div className="table-toolbar">
        <span>Registros por página</span>
        <PageSizeSelect value={pageSize} onChange={setPageSize} />
      </div>

      <div className="two-panels">
        <section className="panel">
          <div className="section-head compact">
            <div>
              <h3>Origem não localizada no destino</h3>
              <p>{number(missing.length)} registros.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Código</th><th>{profile.recordLabel}</th><th>Origem inativa</th><th>Resultado</th><th></th></tr>
              </thead>
              <tbody>
                {originItems.map(client => (
                  <tr key={client.key}>
                    <td className="mono">{client.key}</td>
                    <td>{client.name || '—'}</td>
                    <td>{client.originInactive ? 'Sim' : 'Não'}</td>
                    <td><StatusBadge status={client.status} /></td>
                    <td>
                      <button className="link-button" onClick={() => onOpenClient(client)}>Analisar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={originPage} pages={originPages} onChange={setOriginPage} />
        </section>

        <section className="panel">
          <div className="section-head compact">
            <div>
              <h3>Somente no destino</h3>
              <p>{number(report.targetOnly.length)} registros.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>{profile.recordLabel}</th></tr></thead>
              <tbody>
                {targetItems.map(client => (
                  <tr key={client.key}>
                    <td className="mono">{client.key}</td>
                    <td>{client.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={targetPage} pages={targetPages} onChange={setTargetPage} />
        </section>
      </div>
    </div>
  )
}

export default App
