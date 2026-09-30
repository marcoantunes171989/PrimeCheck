import { useMemo, useState } from 'react'
import DataPrintReport from './DataPrintReport'
import type { ComparisonReport, EntityProfile } from '../types'

const PAGE_SIZE = 20
const number = (value: number) => value.toLocaleString('pt-BR')
const pct = (value: number) => value.toFixed(2).replace('.', ',') + '%'

export default function ManagementDashboardView({
  report,
  profile,
  onAnalyzeField,
}: {
  report: ComparisonReport
  profile: EntityProfile
  onAnalyzeField: (fieldId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('TODOS')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [printSelected, setPrintSelected] = useState(false)

  const conformity = report.summary.validTests
    ? (report.summary.conformTests / report.summary.validTests) * 100
    : 0

  const groups = useMemo(
    () => [...new Set(report.fieldSummary.map(field => field.group))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [report.fieldSummary],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLocaleUpperCase('pt-BR')
    return [...report.fieldSummary]
      .filter(field => groupFilter === 'TODOS' || field.group === groupFilter)
      .filter(field => {
        if (!term) return true
        return [
          field.fieldLabel,
          field.group,
          field.conform,
          field.divergent,
          field.attention,
          field.notValidatable,
          field.conformityPercent ?? '',
        ].join(' ').toLocaleUpperCase('pt-BR').includes(term)
      })
      .sort((a, b) =>
        (b.divergent * 3 + b.attention * 2 + b.notValidatable)
        - (a.divergent * 3 + a.attention * 2 + a.notValidatable)
        || a.fieldLabel.localeCompare(b.fieldLabel, 'pt-BR'),
      )
  }, [report.fieldSummary, search, groupFilter])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageIds = pageRows.map(field => field.fieldId)
  const selectedRows = rows.filter(field => selected.has(field.fieldId))
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id))

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
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

  const printRows = (printSelected ? selectedRows : rows).map(field => ({
    campo: field.fieldLabel,
    grupo: field.group,
    conformes: field.conform,
    divergentes: field.divergent,
    atencoes: field.attention,
    naoValidaveis: field.notValidatable,
    conformidade: field.conformityPercent === null ? '—' : pct(field.conformityPercent),
    analisado: reviewed.has(field.fieldId) ? 'Sim' : 'Não',
  }))

  const topFields = rows.slice(0, 6)
  const maxProblem = Math.max(1, ...topFields.map(field => field.divergent + field.attention + field.notValidatable))

  return (
    <>
      <section className="management-dashboard">
        <div className="dashboard-kpis">
          <article>
            <span>Registros origem</span>
            <strong>{number(report.summary.originTotal)}</strong>
            <small>{number(report.summary.foundTotal)} localizados no destino</small>
          </article>
          <article>
            <span>Divergentes</span>
            <strong>{number(report.summary.divergentClients)}</strong>
            <small>registros com erro</small>
          </article>
          <article>
            <span>Atenção</span>
            <strong>{number(report.summary.attentionClients)}</strong>
            <small>registros para revisão</small>
          </article>
          <article>
            <span>Não importados</span>
            <strong>{number(report.summary.notImportedClients)}</strong>
            <small>origem sem correspondência</small>
          </article>
          <article>
            <span>Duplicidades</span>
            <strong>{number(report.duplicates.length)}</strong>
            <small>grupos identificados</small>
          </article>
          <article className="dashboard-kpi-conformity">
            <span>Conformidade</span>
            <strong>{pct(conformity)}</strong>
            <small>{number(report.summary.conformTests)} de {number(report.summary.validTests)} testes</small>
          </article>
        </div>

        <div className="dashboard-grid">
          <section className="panel dashboard-panel">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">STATUS GERAL</span>
                <h3>Distribuição dos registros</h3>
              </div>
            </div>
            <div className="dashboard-status-bars">
              {[
                ['Conformes', report.summary.conformClients, report.summary.originTotal, 'ok'],
                ['Divergentes', report.summary.divergentClients, report.summary.originTotal, 'error'],
                ['Atenção', report.summary.attentionClients, report.summary.originTotal, 'warning'],
                ['Não importados', report.summary.notImportedClients, report.summary.originTotal, 'muted'],
              ].map(([label, value, total, tone]) => {
                const amount = Number(value)
                const base = Number(total)
                const percentage = base ? (amount / base) * 100 : 0
                return (
                  <div className="dashboard-status-row" key={String(label)}>
                    <div><span>{label}</span><strong>{number(amount)}</strong></div>
                    <div className="dashboard-status-track">
                      <i className={'tone-' + tone} style={{ width: Math.max(1, percentage) + '%' }} />
                    </div>
                    <small>{pct(percentage)}</small>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel dashboard-panel">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">PRIORIDADE</span>
                <h3>Campos com maior necessidade de manutenção</h3>
              </div>
            </div>
            <div className="dashboard-field-bars stable-filter-list">
              {topFields.map(field => {
                const problem = field.divergent + field.attention + field.notValidatable
                return (
                  <button type="button" key={field.fieldId} onClick={() => onAnalyzeField(field.fieldId)}>
                    <div>
                      <strong>{field.fieldLabel}</strong>
                      <span>{field.divergent} divergências · {field.attention} atenções</span>
                    </div>
                    <div className="dashboard-field-track">
                      <i style={{ width: Math.max(4, (problem / maxProblem) * 100) + '%' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <section className="panel dashboard-detail-panel">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">ANÁLISE POR CAMPO</span>
              <h3>{profile.label} · indicadores gerenciais</h3>
              <p>{number(rows.length)} campos no filtro · paginação padrão de {PAGE_SIZE} registros.</p>
            </div>
            <div className="section-head-actions">
              <span className="selection-summary">{number(selectedRows.length)} selecionados</span>
              <button type="button" className="button ghost compact-button" disabled={!pageRows.length} onClick={togglePage}>
                {allPageSelected ? 'Desmarcar página' : 'Selecionar página'}
              </button>
              <button type="button" className="button secondary compact-button" disabled={!selectedRows.length} onClick={() => requestPrint(true)}>
                Imprimir selecionados
              </button>
              <button type="button" className="button primary compact-button" disabled={!rows.length} onClick={() => requestPrint(false)}>
                Imprimir filtro
              </button>
            </div>
          </div>

          <div className="dashboard-toolbar">
            <label className="screen-search inline-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={event => { setSearch(event.target.value); setPage(1) }}
                placeholder="Pesquisar campo, grupo ou indicador…"
              />
            </label>
            <select value={groupFilter} onChange={event => { setGroupFilter(event.target.value); setPage(1) }}>
              <option value="TODOS">Todos os grupos</option>
              {groups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </div>

          <div className="table-wrap stable-filter-table-wrap">
            <table className="dashboard-field-table analytic-report-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Selecionar página" /></th>
                  <th>Campo</th>
                  <th>Grupo</th>
                  <th>Conformes</th>
                  <th>Divergentes</th>
                  <th>Atenções</th>
                  <th>Não validáveis</th>
                  <th>% conformidade</th>
                  <th>Análise</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(field => (
                  <tr key={field.fieldId} className={reviewed.has(field.fieldId) ? 'row-reviewed' : ''}>
                    <td><input type="checkbox" checked={selected.has(field.fieldId)} onChange={() => setSelected(current => toggle(current, field.fieldId))} /></td>
                    <td><strong>{field.fieldLabel}</strong></td>
                    <td>{field.group}</td>
                    <td>{number(field.conform)}</td>
                    <td className="text-error">{number(field.divergent)}</td>
                    <td className="text-warning">{number(field.attention)}</td>
                    <td>{number(field.notValidatable)}</td>
                    <td>{field.conformityPercent === null ? '—' : pct(field.conformityPercent)}</td>
                    <td>
                      <button
                        type="button"
                        className={'review-chip ' + (reviewed.has(field.fieldId) ? 'done' : '')}
                        onClick={() => setReviewed(current => toggle(current, field.fieldId))}
                      >
                        {reviewed.has(field.fieldId) ? '✓ Analisado' : 'Marcar analisado'}
                      </button>
                    </td>
                    <td><button type="button" className="analysis-action-button" onClick={() => onAnalyzeField(field.fieldId)}>Ver campo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="workspace-pagination dashboard-pagination">
            <span>
              {rows.length
                ? `${((safePage - 1) * PAGE_SIZE + 1).toLocaleString('pt-BR')}–${Math.min(safePage * PAGE_SIZE, rows.length).toLocaleString('pt-BR')} de ${rows.length.toLocaleString('pt-BR')}`
                : '0 registros'}
            </span>
            <div>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>←</button>
              <b>{safePage}/{pages}</b>
              <button type="button" disabled={safePage >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>→</button>
            </div>
          </div>
        </section>
      </section>

      <DataPrintReport
        title={'Dashboard gerencial · ' + profile.label}
        subtitle="Análise consolidada da homologação entre origem e destino"
        filterDescription={[
          search.trim() ? 'Pesquisa: ' + search.trim() : '',
          groupFilter !== 'TODOS' ? 'Grupo: ' + groupFilter : 'Todos os grupos',
          printSelected ? 'Somente itens selecionados' : 'Resultado filtrado',
        ].filter(Boolean).join(' · ')}
        columns={[
          { key: 'campo', label: 'Campo' },
          { key: 'grupo', label: 'Grupo' },
          { key: 'conformes', label: 'Conformes' },
          { key: 'divergentes', label: 'Divergentes' },
          { key: 'atencoes', label: 'Atenções' },
          { key: 'naoValidaveis', label: 'Não validáveis' },
          { key: 'conformidade', label: '% conformidade' },
          { key: 'analisado', label: 'Analisado' },
        ]}
        rows={printRows}
      />
    </>
  )
}
