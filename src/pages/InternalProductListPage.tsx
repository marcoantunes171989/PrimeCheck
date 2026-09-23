import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatBytes, parseFile } from '../lib/files'
import {
  clearInternalProductList,
  loadInternalProductList,
  saveInternalProductList,
  type InternalProductRow,
  type InternalProductSnapshot,
} from '../lib/internalProductStorage'
import { asText, normalizeHeader, stripAccents } from '../lib/normalizers'

type SortKey = 'code' | 'description'
type SortDirection = 'asc' | 'desc'

const CODE_ALIASES = [
  'CODIGO',
  'COD',
  'COD_PRODUTO',
  'CODIGO_PRODUTO',
  'COD_ITEM',
  'CODIGO_ITEM',
  'ID_PRODUTO',
  'COD_INTERNO',
  'CODIGO_INTERNO',
]

const DESCRIPTION_ALIASES = [
  'DESCRICAO',
  'DESCRIÇÃO',
  'DES_PRODUTO',
  'DESCRICAO_PRODUTO',
  'DESCRIÇÃO_PRODUTO',
  'DES_ITEM',
  'NOME_PRODUTO',
  'PRODUTO',
  'NOME',
]

const normalizeSearch = (value: string) =>
  stripAccents(value)
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()

const matchesQuery = (value: string, query: string) => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return true
  const haystack = normalizeSearch(value)
  return normalizedQuery.split(' ').filter(Boolean).every(token => haystack.includes(token))
}

const findHeader = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader)
  const exact = headers.find(header => normalizedAliases.includes(normalizeHeader(header)))
  if (exact) return exact

  return headers.find(header => {
    const source = normalizeHeader(header)
    if (!source) return false
    return normalizedAliases.some(alias =>
      alias.length >= 4 && (source.includes(alias) || alias.includes(source)),
    )
  })
}

const buildSnapshot = async (file: File): Promise<InternalProductSnapshot> => {
  const parsedSheets = await parseFile(file)
  const rows: InternalProductRow[] = []
  const codeHeaders = new Set<string>()
  const descriptionHeaders = new Set<string>()
  const unmatchedSheets: string[] = []

  parsedSheets.forEach(sheet => {
    const codeHeader = findHeader(sheet.headers, CODE_ALIASES)
    const descriptionHeader = findHeader(sheet.headers, DESCRIPTION_ALIASES)

    if (!codeHeader || !descriptionHeader) {
      unmatchedSheets.push(sheet.sheetName || 'Planilha principal')
      return
    }

    codeHeaders.add(codeHeader)
    descriptionHeaders.add(descriptionHeader)

    sheet.rows.forEach((row, index) => {
      const code = asText(row[codeHeader])
      const description = asText(row[descriptionHeader])
      if (!code && !description) return

      rows.push({
        id: `${sheet.id}:${index}`,
        code,
        description,
        sourceSheet: sheet.sheetName,
      })
    })
  })

  if (!rows.length) {
    const detail = unmatchedSheets.length
      ? ` Planilhas analisadas: ${unmatchedSheets.join(', ')}.`
      : ''
    throw new Error(
      'Não foi possível identificar simultaneamente as colunas de código e descrição.' +
      detail +
      ' Use cabeçalhos como CODIGO/COD_PRODUTO e DESCRICAO/DES_PRODUTO.',
    )
  }

  return {
    fileName: file.name,
    size: file.size,
    extension: file.name.split('.').pop()?.toLowerCase() ?? '',
    importedAt: new Date().toISOString(),
    codeHeaders: [...codeHeaders],
    descriptionHeaders: [...descriptionHeaders],
    rows,
  }
}

export default function InternalProductListPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<{ x: number; y: number } | null>(null)
  const [snapshot, setSnapshot] = useState<InternalProductSnapshot | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [descriptionSearch, setDescriptionSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    let active = true
    void loadInternalProductList().then(stored => {
      if (!active) return
      setSnapshot(stored)
      setRestoring(false)
    })
    return () => { active = false }
  }, [])

  const rememberViewport = () => {
    if (typeof window === 'undefined') return
    viewportRef.current = { x: window.scrollX, y: window.scrollY }
  }

  const clearSearch = (preserveViewport = true) => {
    if (preserveViewport) rememberViewport()
    setGlobalSearch('')
    setCodeSearch('')
    setDescriptionSearch('')
    setPage(1)
  }

  const updateSearch = (
    setter: (value: string) => void,
    value: string,
  ) => {
    rememberViewport()
    setter(value)
    setPage(1)
  }

  const handleImport = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const next = await buildSnapshot(file)
      await saveInternalProductList(next)
      setSnapshot(next)
      clearSearch(false)
      setSortKey('code')
      setSortDirection('asc')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível importar o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  const clearInformation = async () => {
    await clearInternalProductList()
    setSnapshot(null)
    setError('')
    clearSearch(false)
  }

  const changeSort = (key: SortKey) => {
    setPage(1)
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const filteredRows = useMemo(() => {
    const rows = snapshot?.rows ?? []
    const filtered = rows.filter(row => {
      const globalValue = `${row.code} ${row.description}`
      return matchesQuery(globalValue, globalSearch)
        && matchesQuery(row.code, codeSearch)
        && matchesQuery(row.description, descriptionSearch)
    })

    return [...filtered].sort((a, b) => {
      const left = sortKey === 'code' ? a.code : a.description
      const right = sortKey === 'code' ? b.code : b.description
      const compared = left.localeCompare(right, 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      })
      return sortDirection === 'asc' ? compared : -compared
    })
  }, [snapshot, globalSearch, codeSearch, descriptionSearch, sortKey, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredRows, safePage, pageSize],
  )

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof window === 'undefined') return

    viewportRef.current = null
    window.scrollTo({
      left: viewport.x,
      top: viewport.y,
      behavior: 'auto',
    })
  }, [globalSearch, codeSearch, descriptionSearch, pageSize])

  const hasSearch = Boolean(globalSearch || codeSearch || descriptionSearch)

  return (
    <main className="workspace-import-page internal-products-page">
      <section className="workspace-import-hero">
        <div>
          <span className="eyebrow">ETAPA 1 · IMPORTAÇÃO</span>
          <h1>Lista de Produtos Internos</h1>
          <p>
            Carregue o arquivo de produtos internos. O PrimeCheck identifica automaticamente as colunas
            de código e descrição e mantém a lista disponível para consulta.
          </p>
        </div>

        <div className="workspace-import-hero-actions">
          <div className="workspace-storage-state">
            <i />
            <span>
              {restoring
                ? 'Restaurando lista salva…'
                : snapshot
                  ? 'Lista de produtos salva neste navegador.'
                  : 'Nenhuma lista salva neste navegador.'}
            </span>
          </div>
          <div className="workspace-import-counter">
            <strong>{snapshot ? '1/1' : '0/1'}</strong>
            <span>{snapshot ? 'arquivo' : 'arquivos'}</span>
          </div>
        </div>
      </section>

      <section
        className={'workspace-dropzone ' + (dragging ? 'dragging' : '')}
        onDragOver={event => {
          event.preventDefault()
          if (!busy && !restoring) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          if (busy || restoring) return
          const file = event.dataTransfer.files?.[0]
          if (file) void handleImport(file)
        }}
        onClick={() => {
          if (!busy && !restoring) inputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && !busy && !restoring) {
            inputRef.current?.click()
          }
        }}
        aria-disabled={busy || restoring}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".csv,.txt,.tsv,.xls,.xlsx,.xlsm,.xlsb,.ods,.fods"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleImport(file)
            event.currentTarget.value = ''
          }}
        />
        <div className="workspace-drop-icon">⇧</div>
        <strong>
          {busy
            ? 'Lendo e identificando o arquivo…'
            : snapshot
              ? 'Arraste um novo arquivo aqui ou clique para substituir'
              : 'Arraste o arquivo aqui ou clique para selecionar'}
        </strong>
        <span>1 arquivo · CSV, TXT, TSV, XLS, XLSX, XLSM, XLSB e ODS</span>
      </section>

      {error && (
        <div className="workspace-import-errors">
          <span>{error}</span>
        </div>
      )}

      <section className="workspace-import-grid internal-products-import-grid">
        {snapshot ? (
          <article className="workspace-file-card internal-products-file-card">
            <div className="workspace-file-head">
              <div>
                <span className="workspace-file-type">ARQUIVO IMPORTADO</span>
                <strong title={snapshot.fileName}>{snapshot.fileName}</strong>
                <small>
                  {snapshot.rows.length.toLocaleString('pt-BR')} registros · {formatBytes(snapshot.size)}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => void clearInformation()}
                aria-label={'Remover ' + snapshot.fileName}
                title="Limpar informações importadas"
              >
                ×
              </button>
            </div>
            <div className="workspace-file-modules">
              <span>Código · {snapshot.codeHeaders.join(', ')}</span>
              <span>Descrição · {snapshot.descriptionHeaders.join(', ')}</span>
            </div>
          </article>
        ) : (
          <div className="workspace-import-empty">
            <strong>{restoring ? 'Restaurando lista salva…' : 'Nenhum arquivo importado.'}</strong>
            <span>
              Importe uma lista com uma coluna de código e outra de descrição para habilitar a consulta
              de produtos internos.
            </span>
          </div>
        )}
      </section>

      {snapshot && (
        <>
          <section className="internal-products-summary">
            <div>
              <span>Registros importados</span>
              <strong>{snapshot.rows.length.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Arquivo</span>
              <strong title={snapshot.fileName}>{snapshot.fileName}</strong>
              <small>{formatBytes(snapshot.size)} · {snapshot.extension.toUpperCase()}</small>
            </div>
            <div>
              <span>Coluna de código</span>
              <strong>{snapshot.codeHeaders.join(', ')}</strong>
            </div>
            <div>
              <span>Coluna de descrição</span>
              <strong>{snapshot.descriptionHeaders.join(', ')}</strong>
            </div>
          </section>

          <section className="internal-products-panel">
            <div className="internal-products-toolbar">
              <label className="workspace-data-search internal-products-global-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={globalSearch}
                  onChange={event => updateSearch(setGlobalSearch, event.target.value)}
                  placeholder="Pesquisar em código e descrição…"
                  aria-label="Pesquisar em todos os campos"
                />
              </label>

              <select
                value={pageSize}
                onChange={event => {
                  rememberViewport()
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                aria-label="Registros por página"
              >
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={250}>250 por página</option>
                <option value={500}>500 por página</option>
              </select>

              <button
                type="button"
                className="button internal-products-clear-search"
                onClick={() => clearSearch()}
                disabled={!hasSearch}
              >
                Limpar pesquisa
              </button>

              <button
                type="button"
                className="button internal-products-clear-data"
                onClick={() => void clearInformation()}
              >
                Limpar informações
              </button>
            </div>

            <div className="internal-products-result-bar">
              <span>
                Exibindo <strong>{filteredRows.length.toLocaleString('pt-BR')}</strong> de{' '}
                <strong>{snapshot.rows.length.toLocaleString('pt-BR')}</strong> registros
              </span>
              <small>Busca instantânea por caractere · acentos ignorados</small>
            </div>

            <div className="internal-products-table-wrap">
              <table className="workspace-data-table internal-products-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" onClick={() => changeSort('code')}>
                        Código
                        <i>{sortKey === 'code' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</i>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => changeSort('description')}>
                        Descrição
                        <i>{sortKey === 'description' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</i>
                      </button>
                    </th>
                  </tr>
                  <tr className="internal-products-filter-row">
                    <th>
                      <input
                        value={codeSearch}
                        onChange={event => updateSearch(setCodeSearch, event.target.value)}
                        placeholder="Buscar por código…"
                        aria-label="Buscar por código"
                      />
                    </th>
                    <th>
                      <input
                        value={descriptionSearch}
                        onChange={event => updateSearch(setDescriptionSearch, event.target.value)}
                        placeholder="Buscar por descrição…"
                        aria-label="Buscar por descrição"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map(row => (
                    <tr key={row.id}>
                      <td data-label="Código" className="internal-products-code">{row.code || '—'}</td>
                      <td data-label="Descrição">{row.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!filteredRows.length && (
                <div className="workspace-data-empty">
                  <strong>Nenhum registro encontrado.</strong>
                  <span>Apague ou ajuste os filtros para visualizar novamente a lista importada.</span>
                </div>
              )}
            </div>

            <div className="workspace-pagination internal-products-pagination">
              <span>
                Página {safePage.toLocaleString('pt-BR')} de {totalPages.toLocaleString('pt-BR')}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                >
                  ‹
                </button>
                <b>{safePage.toLocaleString('pt-BR')}</b>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Próxima página"
                >
                  ›
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
