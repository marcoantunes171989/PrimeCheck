import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [snapshot, setSnapshot] = useState<InternalProductSnapshot | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)
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

  const clearSearch = () => {
    setGlobalSearch('')
    setCodeSearch('')
    setDescriptionSearch('')
    setPage(1)
  }

  const handleImport = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const next = await buildSnapshot(file)
      await saveInternalProductList(next)
      setSnapshot(next)
      clearSearch()
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
    clearSearch()
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

  useEffect(() => {
    setPage(1)
  }, [globalSearch, codeSearch, descriptionSearch, pageSize])

  const hasSearch = Boolean(globalSearch || codeSearch || descriptionSearch)

  return (
    <main className="internal-products-page">
      <section className="workspace-data-head internal-products-head">
        <div>
          <span className="eyebrow">ARQUIVOS E DADOS</span>
          <h1>Lista de Produtos Internos</h1>
          <p>
            Importe uma lista interna de produtos, pesquise por código ou descrição e ordene os dados
            diretamente pela tabela.
          </p>
        </div>
        <div className="internal-products-head-actions">
          <div className="workspace-storage-state">
            <i />
            <span>
              {restoring
                ? 'Restaurando lista salva…'
                : snapshot
                  ? 'Lista salva neste navegador.'
                  : 'Nenhuma lista salva neste navegador.'}
            </span>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={busy || restoring}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Importando…' : snapshot ? 'Substituir arquivo' : 'Importar arquivo'}
          </button>
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
        </div>
      </section>

      {error && <div className="internal-products-error">{error}</div>}

      {snapshot ? (
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
                  onChange={event => setGlobalSearch(event.target.value)}
                  placeholder="Pesquisar em código e descrição…"
                  aria-label="Pesquisar em todos os campos"
                />
              </label>

              <select
                value={pageSize}
                onChange={event => setPageSize(Number(event.target.value))}
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
                onClick={clearSearch}
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
                        onChange={event => setCodeSearch(event.target.value)}
                        placeholder="Buscar por código…"
                        aria-label="Buscar por código"
                      />
                    </th>
                    <th>
                      <input
                        value={descriptionSearch}
                        onChange={event => setDescriptionSearch(event.target.value)}
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
      ) : (
        <section className="internal-products-empty">
          <div className="workspace-drop-icon">▤</div>
          <strong>{restoring ? 'Restaurando informações…' : 'Nenhuma lista de produtos importada.'}</strong>
          <span>
            Importe um arquivo CSV, XLS ou XLSX com uma coluna de código e outra de descrição.
            A lista permanecerá salva neste navegador até você clicar em “Limpar informações”.
          </span>
          {!restoring && (
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Importar lista de produtos
            </button>
          )}
        </section>
      )}
    </main>
  )
}
