import { useEffect, useMemo, useState } from 'react'
import { resolveModuleHeaders, type WorkspaceModuleDefinition } from '../config/workspaceModules'
import type { ImportedFile } from '../types'

type SortDirection = 'asc' | 'desc'

const textValue = (value: unknown) => String(value ?? '').trim()

export default function WorkspaceDataPage({
  module,
  files,
  onBackToImport,
}: {
  module: WorkspaceModuleDefinition
  files: ImportedFile[]
  onBackToImport: () => void
}) {
  const resolved = useMemo(() => resolveModuleHeaders(files, module), [files, module])
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState(resolved.fields[0]?.header ?? '')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const rows = useMemo(() => resolved.files.flatMap(file =>
    file.rows.map((row, index) => ({
      row,
      source: file.name,
      sheet: file.sheetName ?? '',
      __key: file.id + ':' + index,
    })),
  ), [resolved.files])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleUpperCase('pt-BR')
    if (!term) return rows
    return rows.filter(item => {
      const fieldText = resolved.fields
        .map(field => textValue(item.row[field.header]))
        .join(' ')
      return [
        item.source,
        item.sheet,
        fieldText,
      ].join(' ').toLocaleUpperCase('pt-BR').includes(term)
    })
  }, [rows, resolved.fields, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((left, right) => {
      const a = textValue(left.row[sortKey])
      const b = textValue(right.row[sortKey])
      const compared = a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? compared : -compared
    })
  }, [filtered, sortDirection, sortKey])

  useEffect(() => setPage(1), [search, pageSize, sortKey, sortDirection, module.id])

  useEffect(() => {
    if (!resolved.fields.some(field => field.header === sortKey)) {
      setSortKey(resolved.fields[0]?.header ?? '')
      setSortDirection('asc')
    }
  }, [module.id, resolved.fields, sortKey])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pages)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (header: string) => {
    if (sortKey === header) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(header)
      setSortDirection('asc')
    }
  }

  return (
    <main className="workspace-data-page">
      <header className="workspace-data-head">
        <div>
          <span className="eyebrow">MÓDULO · {module.group.toUpperCase()}</span>
          <h1>{module.label}</h1>
          <p>{module.description}</p>
        </div>
        <button type="button" className="button ghost" onClick={onBackToImport}>
          Gerenciar arquivos
        </button>
      </header>

      <section className="workspace-data-summary">
        <div>
          <span>Registros disponíveis</span>
          <strong>{rows.length.toLocaleString('pt-BR')}</strong>
        </div>
        <div>
          <span>Campos reconhecidos</span>
          <strong>{resolved.fields.length}</strong>
        </div>
        <div>
          <span>Arquivos relacionados</span>
          <strong>{resolved.files.length}</strong>
        </div>
        <div className="workspace-source-files">
          <span>Fontes</span>
          <div>
            {[...new Set(resolved.files.map(file => file.name))].map(name => <b key={name}>{name}</b>)}
          </div>
        </div>
      </section>

      <section className="workspace-fields-bar">
        <div>
          <strong>Campos deste módulo</strong>
          <span>Somente informações relacionadas a {module.label.toLowerCase()} são apresentadas aqui.</span>
        </div>
        <div className="workspace-field-chips">
          {resolved.fields.map(field => (
            <span key={field.id} title={'Coluna identificada: ' + field.header}>
              {field.label}
            </span>
          ))}
        </div>
      </section>

      <section className="workspace-data-panel">
        <div className="workspace-data-toolbar">
          <label className="workspace-data-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={'Pesquisar em ' + module.label.toLowerCase() + '…'}
              aria-label={'Pesquisar em ' + module.label}
            />
          </label>

          <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>

        {resolved.fields.length === 0 ? (
          <div className="workspace-data-empty">
            <strong>Nenhum campo específico foi reconhecido.</strong>
            <span>Revise os cabeçalhos do arquivo ou volte para a importação.</span>
          </div>
        ) : (
          <>
            <div className="workspace-data-table-wrap stable-filter-table-wrap">
              <table className="workspace-data-table analytic-report-table">
                <thead>
                  <tr>
                    {resolved.fields.map(field => (
                      <th key={field.id}>
                        <button type="button" onClick={() => toggleSort(field.header)}>
                          <span>{field.label}</span>
                          <i>{sortKey === field.header ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</i>
                        </button>
                      </th>
                    ))}
                    <th>Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(item => (
                    <tr key={item.__key}>
                      {resolved.fields.map(field => (
                        <td key={field.id} data-label={field.label}>
                          {textValue(item.row[field.header]) || '—'}
                        </td>
                      ))}
                      <td data-label="Arquivo">
                        <span className="workspace-source-badge">
                          {item.source}{item.sheet ? ' · ' + item.sheet : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="workspace-pagination">
              <span>
                {sorted.length
                  ? `${((safePage - 1) * pageSize + 1).toLocaleString('pt-BR')}–${Math.min(safePage * pageSize, sorted.length).toLocaleString('pt-BR')} de ${sorted.length.toLocaleString('pt-BR')}`
                  : '0 registros'}
              </span>
              <div>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>←</button>
                <b>{safePage}/{pages}</b>
                <button type="button" disabled={safePage >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>→</button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
