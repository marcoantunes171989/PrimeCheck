import { useMemo, useState } from 'react'
import DataPrintReport from './DataPrintReport'
import StatusBadge from './StatusBadge'
import type {
  ClientComparison,
  ComparisonFieldResult,
  ComparisonReport,
  DuplicateItem,
  EntityProfile,
  Severity,
} from '../types'

type QuickKind = 'DIVERGÊNCIA' | 'ATENÇÃO' | 'DUPLICIDADE'

type QuickItem = {
  id: string
  kind: QuickKind
  fieldId: string
  fieldLabel: string
  group: string
  code: string
  name: string
  origin: string
  target: string
  status: string
  reason: string
  occurrences: number
  client?: ClientComparison
  field?: ComparisonFieldResult
  duplicate?: DuplicateItem
}

const normalize = (value: unknown) =>
  String(value ?? '').trim().toLocaleUpperCase('pt-BR')

const includes = (value: unknown, filter: string) =>
  !filter.trim() || normalize(value).includes(normalize(filter))

const issuePriority = (status: Severity) =>
  status === 'DIVERGENTE' ? 0 : status === 'ATENÇÃO' ? 1 : 9

export default function TechnicalDiagnosisView({
  report,
  profile,
  onOpenIssue,
  onOpenDuplicates,
}: {
  report: ComparisonReport
  profile: EntityProfile
  onOpenIssue: (client: ClientComparison, field: ComparisonFieldResult) => void
  onOpenDuplicates: (fieldId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'TODOS' | QuickKind>('TODOS')
  const [fieldFilter, setFieldFilter] = useState('TODOS')
  const [codeFilter, setCodeFilter] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')

  const items = useMemo<QuickItem[]>(() => {
    const issues = report.fieldSummary
      .filter(summary => summary.divergent > 0 || summary.attention > 0)
      .flatMap(summary => {
        const candidates = report.clients
          .flatMap(client => client.fields
            .filter(field =>
              field.fieldId === summary.fieldId
              && (field.status === 'DIVERGENTE' || field.status === 'ATENÇÃO'),
            )
            .map(field => ({ client, field })),
          )
          .sort((left, right) => issuePriority(left.field.status) - issuePriority(right.field.status))

        const representative = candidates[0]
        if (!representative) return []

        return [{
          id: 'issue:' + summary.fieldId,
          kind: representative.field.status === 'DIVERGENTE' ? 'DIVERGÊNCIA' : 'ATENÇÃO',
          fieldId: summary.fieldId,
          fieldLabel: summary.fieldLabel,
          group: summary.group,
          code: representative.client.key,
          name: representative.client.name,
          origin: representative.field.originValue,
          target: representative.field.targetValue,
          status: representative.field.status,
          reason: representative.field.reason,
          occurrences: summary.divergent + summary.attention,
          client: representative.client,
          field: representative.field,
        } satisfies QuickItem]
      })

    const duplicateGroups = new Map<string, DuplicateItem[]>()
    report.duplicates.forEach(duplicate => {
      const current = duplicateGroups.get(duplicate.fieldId) ?? []
      current.push(duplicate)
      duplicateGroups.set(duplicate.fieldId, current)
    })

    const duplicates: QuickItem[] = [...duplicateGroups.entries()].map(([fieldId, groups]) => {
      const representative = [...groups].sort((a, b) =>
        a.side.localeCompare(b.side, 'pt-BR')
        || b.count - a.count
        || a.normalizedValue.localeCompare(b.normalizedValue, 'pt-BR', { numeric: true }),
      )[0]

      const codes = representative.records.map(record => record.key).filter(Boolean)
      const groupRecordCount = groups.reduce((total, group) => total + group.count, 0)

      return {
        id: 'duplicate:' + fieldId,
        kind: 'DUPLICIDADE',
        fieldId,
        fieldLabel: representative.fieldLabel,
        group: representative.fieldGroup,
        code: codes[0] ?? '—',
        name: representative.records[0]?.name ?? '',
        origin: representative.normalizedValue || '—',
        target: codes.length
          ? 'Códigos: ' + codes.slice(0, 6).join(', ') + (codes.length > 6 ? ` +${codes.length - 6}` : '')
          : '—',
        status: 'DUPLICIDADE · ' + representative.side,
        reason: `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'} neste campo · ${groupRecordCount} registros envolvidos. Exemplo com ${representative.count} registros.`,
        occurrences: groups.length,
        duplicate: representative,
      }
    })

    return [...issues, ...duplicates].sort((a, b) =>
      a.fieldLabel.localeCompare(b.fieldLabel, 'pt-BR', { sensitivity: 'base' })
      || a.kind.localeCompare(b.kind, 'pt-BR'),
    )
  }, [report])

  const fieldOptions = useMemo(() =>
    [...new Map(items.map(item => [item.fieldId, item.fieldLabel])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR', { sensitivity: 'base' })),
  [items])

  const filtered = useMemo(() => {
    const term = normalize(search)

    return items.filter(item => {
      if (kindFilter !== 'TODOS' && item.kind !== kindFilter) return false
      if (fieldFilter !== 'TODOS' && item.fieldId !== fieldFilter) return false
      if (!includes(item.code + ' ' + item.name, codeFilter)) return false
      if (!includes(item.origin, originFilter)) return false
      if (!includes(item.target, targetFilter)) return false
      if (!includes(item.status, statusFilter)) return false
      if (!includes(item.reason, reasonFilter)) return false

      if (!term) return true
      return normalize([
        item.kind,
        item.fieldLabel,
        item.group,
        item.code,
        item.name,
        item.origin,
        item.target,
        item.status,
        item.reason,
        item.occurrences,
      ].join(' ')).includes(term)
    })
  }, [
    items,
    search,
    kindFilter,
    fieldFilter,
    codeFilter,
    originFilter,
    targetFilter,
    statusFilter,
    reasonFilter,
  ])

  const filterDescription = [
    kindFilter === 'TODOS' ? 'Todos os tipos' : kindFilter,
    fieldFilter === 'TODOS'
      ? 'Todos os campos'
      : fieldOptions.find(([id]) => id === fieldFilter)?.[1] || fieldFilter,
    search.trim() ? 'Pesquisa: ' + search.trim() : '',
    codeFilter.trim() ? 'Código/registro: ' + codeFilter.trim() : '',
    originFilter.trim() ? 'Origem: ' + originFilter.trim() : '',
    targetFilter.trim() ? 'Destino: ' + targetFilter.trim() : '',
    statusFilter.trim() ? 'Status: ' + statusFilter.trim() : '',
    reasonFilter.trim() ? 'Motivo: ' + reasonFilter.trim() : '',
  ].filter(Boolean).join(' · ')

  const clearFilters = () => {
    setSearch('')
    setKindFilter('TODOS')
    setFieldFilter('TODOS')
    setCodeFilter('')
    setOriginFilter('')
    setTargetFilter('')
    setStatusFilter('')
    setReasonFilter('')
  }

  const printRows = filtered.map(item => ({
    tipo: item.kind,
    campo: item.fieldLabel,
    codigo: item.code,
    registro: item.name || '—',
    origem: item.origin || '—',
    destino: item.target || '—',
    status: item.status,
    motivo: item.reason,
    ocorrencias: item.occurrences,
  }))

  return (
    <>
      <section className="panel technical-diagnosis">
        <div className="section-head compact technical-diagnosis-head">
          <div>
            <span className="eyebrow">DIAGNÓSTICO RÁPIDO</span>
            <h3>Uma amostra técnica de cada problema encontrado</h3>
            <p>
              Mostra um exemplo representativo por campo com divergência/atenção e um exemplo por campo com duplicidade.
              Use as telas detalhadas para analisar todas as ocorrências.
            </p>
          </div>
          <div className="technical-diagnosis-actions">
            <button type="button" className="button ghost compact-button" onClick={clearFilters}>
              Limpar filtros
            </button>
            <button
              type="button"
              className="button primary compact-button"
              disabled={!filtered.length}
              onClick={() => window.print()}
            >
              Imprimir diagnóstico
            </button>
          </div>
        </div>

        <div className="technical-diagnosis-kpis">
          <div>
            <span>Campos com divergência/atenção</span>
            <strong>{items.filter(item => item.kind !== 'DUPLICIDADE').length}</strong>
          </div>
          <div>
            <span>Campos com duplicidade</span>
            <strong>{items.filter(item => item.kind === 'DUPLICIDADE').length}</strong>
          </div>
          <div>
            <span>Amostras no filtro</span>
            <strong>{filtered.length}</strong>
          </div>
        </div>

        <div className="screen-search technical-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar em todo o diagnóstico: campo, código, valor, status ou motivo…"
            aria-label="Pesquisar no diagnóstico rápido"
          />
        </div>

        <div className="table-wrap">
          <table className="technical-diagnosis-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Campo</th>
                <th>Código / registro</th>
                <th>Origem / valor</th>
                <th>Destino / referência</th>
                <th>Status</th>
                <th>Motivo / resumo</th>
                <th>Qtd.</th>
                <th>Ação</th>
              </tr>
              <tr className="column-filter-row">
                <th>
                  <select value={kindFilter} onChange={event => setKindFilter(event.target.value as typeof kindFilter)}>
                    <option value="TODOS">Todos</option>
                    <option value="DIVERGÊNCIA">Divergência</option>
                    <option value="ATENÇÃO">Atenção</option>
                    <option value="DUPLICIDADE">Duplicidade</option>
                  </select>
                </th>
                <th>
                  <select value={fieldFilter} onChange={event => setFieldFilter(event.target.value)}>
                    <option value="TODOS">Todos os campos</option>
                    {fieldOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </th>
                <th><input value={codeFilter} onChange={event => setCodeFilter(event.target.value)} placeholder="Filtrar…" /></th>
                <th><input value={originFilter} onChange={event => setOriginFilter(event.target.value)} placeholder="Filtrar…" /></th>
                <th><input value={targetFilter} onChange={event => setTargetFilter(event.target.value)} placeholder="Filtrar…" /></th>
                <th><input value={statusFilter} onChange={event => setStatusFilter(event.target.value)} placeholder="Filtrar…" /></th>
                <th><input value={reasonFilter} onChange={event => setReasonFilter(event.target.value)} placeholder="Filtrar…" /></th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td><span className={'quick-kind quick-kind-' + item.kind.toLocaleLowerCase('pt-BR').replace(/[^a-z]/g, '')}>{item.kind}</span></td>
                  <td>
                    <strong>{item.fieldLabel}</strong>
                    <small className="block-muted">{item.group}</small>
                  </td>
                  <td>
                    <span className="mono">{item.code}</span>
                    <small className="block-muted">{item.name || '—'}</small>
                  </td>
                  <td>{item.origin || '—'}</td>
                  <td>{item.target || '—'}</td>
                  <td>
                    {item.kind === 'DUPLICIDADE'
                      ? <span className="quick-duplicate-status">{item.status}</span>
                      : <StatusBadge status={item.status as Severity} />}
                  </td>
                  <td className="reason-cell">{item.reason}</td>
                  <td><strong>{item.occurrences.toLocaleString('pt-BR')}</strong></td>
                  <td>
                    {item.client && item.field ? (
                      <button
                        type="button"
                        className="analysis-action-button"
                        onClick={() => onOpenIssue(item.client!, item.field!)}
                      >
                        Abrir ocorrência
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="analysis-action-button"
                        onClick={() => onOpenDuplicates(item.fieldId)}
                      >
                        Ver duplicidades
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-state">Nenhum diagnóstico encontrado para a combinação de filtros.</div>}
        </div>
      </section>

      <DataPrintReport
        title="Diagnóstico rápido da homologação"
        subtitle={profile.label + ' · uma amostra representativa por campo/problema'}
        filterDescription={filterDescription}
        columns={[
          { key: 'tipo', label: 'Tipo' },
          { key: 'campo', label: 'Campo' },
          { key: 'codigo', label: 'Código' },
          { key: 'registro', label: profile.recordLabel },
          { key: 'origem', label: 'Origem / valor' },
          { key: 'destino', label: 'Destino / referência' },
          { key: 'status', label: 'Status' },
          { key: 'motivo', label: 'Motivo / resumo' },
          { key: 'ocorrencias', label: 'Qtd.' },
        ]}
        rows={printRows}
      />
    </>
  )
}
