import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatAccessKey,
  formatNfceDate,
  formatNfceMoney,
  nfceSearchText,
  normalizeNfceSearch,
  parseNfceDetail,
  parseNfceFile,
  type NfceSummary,
} from '../lib/nfce'
import {
  clearNfceDocuments,
  initializeWorkspaceScope,
  loadNfceDocuments,
  saveNfceDocuments,
} from '../lib/workspaceStorage'
import '../nfce.css'

const PAGE_SIZE = 100
const BATCH_SIZE = 40

const directText = (element: Element) =>
  Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

const elementName = (element: Element) => element.tagName

type XmlSearchEntry = {
  key: string
  path: string
  name: string
  value: string
  attributes: string
}

const elementOwnSearchText = (element: Element, path: string) => {
  const attributes = Array.from(element.attributes)
    .map(attr => `${attr.name}=${attr.value}`)
    .join(' ')
  return normalizeNfceSearch([
    path,
    elementName(element),
    directText(element),
    attributes,
  ].join(' '))
}

const buildXmlSearchEntries = (root: Element) => {
  const entries: XmlSearchEntry[] = []

  const visit = (element: Element, path: string, key: string) => {
    entries.push({
      key,
      path,
      name: elementName(element),
      value: directText(element),
      attributes: Array.from(element.attributes)
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' '),
    })

    const children = Array.from(element.children)
    children.forEach((child, index) => {
      const childName = elementName(child)
      const sameNameBefore = children.slice(0, index).filter(item => elementName(item) === childName).length
      const sameNameTotal = children.filter(item => elementName(item) === childName).length
      const childPath = `${path}/${childName}${sameNameTotal > 1 ? `[${sameNameBefore + 1}]` : ''}`
      visit(child, childPath, `${key}-${index}`)
    })
  }

  visit(root, '/' + elementName(root), '0')
  return entries
}

const XmlNode = ({
  element,
  path,
  nodeKey,
  searchQuery,
  selectedKey,
  revealKey,
  depth = 0,
}: {
  element: Element
  path: string
  nodeKey: string
  searchQuery: string
  selectedKey: string | null
  revealKey: string | null
  depth?: number
}) => {
  const children = Array.from(element.children)
  const name = elementName(element)
  const value = directText(element)
  const attributes = Array.from(element.attributes)
  const empty = children.length === 0 && !value
  const [open, setOpen] = useState(depth === 0)
  const revealsThisBranch = Boolean(revealKey && (revealKey === nodeKey || revealKey.startsWith(nodeKey + '-')))
  const expanded = children.length > 0 && (open || revealsThisBranch)
  const matched = Boolean(searchQuery && elementOwnSearchText(element, path).includes(searchQuery))
  const selected = selectedKey === nodeKey

  return (
    <div className="nfce-xml-node" id={`nfce-xml-node-${nodeKey}`}>
      <button
        type="button"
        className={[
          'nfce-xml-node-head',
          matched ? 'is-match' : '',
          selected ? 'is-selected' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => children.length && setOpen(current => !current)}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        aria-expanded={children.length ? expanded : undefined}
        title={path}
      >
        <span className="nfce-xml-chevron">{children.length ? (expanded ? '⌄' : '›') : '·'}</span>
        <span className="nfce-xml-tag-preview">
          {empty ? (
            <code>&lt;{name} /&gt;</code>
          ) : children.length ? (
            <code>&lt;{name}&gt;</code>
          ) : (
            <>
              <code>&lt;{name}&gt;</code>
              <strong className="nfce-xml-value">{value}</strong>
              <code>&lt;/{name}&gt;</code>
            </>
          )}
        </span>
        {attributes.length > 0 && (
          <small>{attributes.map(attr => `${attr.name}="${attr.value}"`).join(' ')}</small>
        )}
        {children.length > 0 && value && <strong className="nfce-xml-value">{value}</strong>}
        {empty && <em>sem conteúdo</em>}
      </button>

      {expanded && (
        <div>
          {children.map((child, index) => {
            const childName = elementName(child)
            const sameNameBefore = children.slice(0, index).filter(item => elementName(item) === childName).length
            const sameNameTotal = children.filter(item => elementName(item) === childName).length
            const childPath = `${path}/${childName}${sameNameTotal > 1 ? `[${sameNameBefore + 1}]` : ''}`
            const childKey = `${nodeKey}-${index}`
            return (
              <XmlNode
                key={childKey}
                element={child}
                path={childPath}
                nodeKey={childKey}
                searchQuery={searchQuery}
                selectedKey={selectedKey}
                revealKey={revealKey}
                depth={depth + 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const statusClass = (item: NfceSummary) => {
  if (!item.validXml || !item.isNfce) return 'error'
  if (item.statusCode === '100') return 'ok'
  if (item.statusCode) return 'warning'
  return 'neutral'
}

const statusLabel = (item: NfceSummary) => {
  if (!item.validXml) return 'XML inválido'
  if (!item.isNfce) return 'Não é NFC-e'
  if (item.statusCode === '100') return 'Autorizada'
  return item.statusMessage || (item.statusCode ? `Status ${item.statusCode}` : 'Sem protocolo')
}

export default function NfceValidatorPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const xmlTreeRef = useRef<HTMLDivElement>(null)
  const [documents, setDocuments] = useState<NfceSummary[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUTHORIZED' | 'ISSUES'>('ALL')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<NfceSummary | null>(null)
  const [modalTab, setModalTab] = useState<'danfe' | 'tags' | 'xml'>('danfe')
  const [tagSearch, setTagSearch] = useState('')
  const [selectedXmlKey, setSelectedXmlKey] = useState<string | null>(null)
  const [revealXmlKey, setRevealXmlKey] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [storageScoped, setStorageScoped] = useState(false)
  const [storageMessage, setStorageMessage] = useState('Restaurando XMLs salvos para este IP…')

  const detail = useMemo(() => selected ? parseNfceDetail(selected) : null, [selected])

  useEffect(() => {
    let active = true

    void (async () => {
      const scope = await initializeWorkspaceScope()
      if (!active) return

      if (!scope) {
        setStorageScoped(false)
        setStorageMessage('Não foi possível identificar o IP atual. Os XMLs desta sessão não serão restaurados após fechar ou atualizar a página.')
        setStorageReady(true)
        return
      }

      setStorageScoped(true)
      const stored = await loadNfceDocuments()
      if (!active) return

      setDocuments(stored)
      setStorageMessage(
        stored.length
          ? `${stored.length.toLocaleString('pt-BR')} XML(s) restaurado(s) para este IP.`
          : 'Nenhum XML salvo para este IP.',
      )
      setStorageReady(true)
    })()

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [selected])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const handleFiles = async (incoming: File[]) => {
    if (!incoming.length || busy || !storageReady) return

    const existing = new Set(documents.map(item => `${item.fileName}:${item.size}:${item.lastModified}`))
    const accepted: File[] = []
    const localErrors: string[] = []

    for (const file of incoming) {
      if (!/\.xml$/i.test(file.name)) {
        localErrors.push(`${file.name}: somente arquivos XML são aceitos.`)
        continue
      }
      const fileKey = `${file.name}:${file.size}:${file.lastModified}`
      if (existing.has(fileKey)) continue
      accepted.push(file)
      existing.add(fileKey)
    }

    if (!accepted.length) {
      setErrors(localErrors)
      return
    }

    setBusy(true)
    setProgress({ current: 0, total: accepted.length })
    const parsed: NfceSummary[] = []

    for (let index = 0; index < accepted.length; index += BATCH_SIZE) {
      const batch = accepted.slice(index, index + BATCH_SIZE)
      const result = await Promise.all(batch.map(file => parseNfceFile(file)))
      parsed.push(...result)
      setProgress({ current: Math.min(index + batch.length, accepted.length), total: accepted.length })
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    }

    setDocuments(current => [...current, ...parsed])
    setErrors(localErrors)

    try {
      if (storageScoped) {
        await saveNfceDocuments(parsed)
        setStorageMessage(`${parsed.length.toLocaleString('pt-BR')} XML(s) salvo(s) localmente para este IP.`)
      } else {
        setStorageMessage('XMLs carregados somente nesta sessão porque o IP atual não pôde ser identificado.')
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha no armazenamento local.'
      setErrors(current => [
        ...current,
        `Os XMLs foram carregados nesta sessão, mas não puderam ser armazenados no navegador: ${reason}`,
      ])
      setStorageMessage('XMLs disponíveis nesta sessão, mas o armazenamento local atingiu uma limitação do navegador/dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const query = normalizeNfceSearch(search)
    return documents.filter(item => {
      if (statusFilter === 'AUTHORIZED' && item.statusCode !== '100') return false
      if (statusFilter === 'ISSUES' && item.statusCode === '100' && item.validXml && item.isNfce) return false
      if (!query) return true
      return nfceSearchText(item).includes(query)
    })
  }, [documents, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const authorized = documents.filter(item => item.statusCode === '100' && item.isNfce && item.validXml).length
  const issues = documents.length - authorized
  const totalValue = documents.reduce((sum, item) => sum + item.total, 0)

  const removeAll = async () => {
    if (busy || !storageReady) return

    try {
      await clearNfceDocuments()
      setDocuments([])
      setErrors([])
      setSearch('')
      setStatusFilter('ALL')
      setSelected(null)
      setStorageMessage('Arquivos XML importados removidos para este IP.')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao limpar o armazenamento local.'
      setErrors(current => [...current, reason])
    }
  }

  const openDocument = (item: NfceSummary) => {
    setSelected(item)
    setModalTab('danfe')
    setTagSearch('')
  }

  const rootElement = useMemo(() => {
    if (!selected || modalTab !== 'tags') return null
    const doc = new DOMParser().parseFromString(selected.rawXml, 'application/xml')
    return doc.documentElement
  }, [modalTab, selected])

  const xmlEntries = useMemo(
    () => rootElement ? buildXmlSearchEntries(rootElement) : [],
    [rootElement],
  )

  const normalizedTagSearch = useMemo(
    () => normalizeNfceSearch(tagSearch),
    [tagSearch],
  )

  const xmlMatches = useMemo(() => {
    if (!normalizedTagSearch) return []
    return xmlEntries.filter(entry =>
      normalizeNfceSearch([
        entry.path,
        entry.name,
        entry.value,
        entry.attributes,
      ].join(' ')).includes(normalizedTagSearch),
    )
  }, [normalizedTagSearch, xmlEntries])

  const revealXmlEntry = (entry: XmlSearchEntry) => {
    setSelectedXmlKey(entry.key)
    setRevealXmlKey(entry.key)

    window.requestAnimationFrame(() => {
      const tree = xmlTreeRef.current
      const target = document.getElementById(`nfce-xml-node-${entry.key}`)
      if (!tree || !target) return

      const treeRect = tree.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const targetCenter = targetRect.top - treeRect.top + tree.scrollTop + targetRect.height / 2
      const nextScrollTop = Math.max(0, targetCenter - tree.clientHeight / 2)

      tree.scrollTo({
        top: nextScrollTop,
        behavior: 'smooth',
      })
    })
  }

  useEffect(() => {
    if (!normalizedTagSearch) {
      setSelectedXmlKey(null)
      setRevealXmlKey(null)
      return
    }
    const firstMatch = xmlMatches[0]
    if (firstMatch) revealXmlEntry(firstMatch)
  }, [normalizedTagSearch])

  useEffect(() => {
    if (modalTab !== 'tags') return
    setSelectedXmlKey(null)
    setRevealXmlKey(null)
  }, [selected?.id, modalTab])

  const copyXml = async () => {
    if (!selected) return
    await navigator.clipboard?.writeText(selected.rawXml)
  }

  const printDanfe = () => {
    setModalTab('danfe')
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <main className="workspace-import-page nfce-page">
      <section className="workspace-import-hero nfce-hero">
        <div>
          <span className="eyebrow">VALIDAÇÃO NFC-e · XML MODELO 65</span>
          <h1>Validação de NFC-e</h1>
          <p>
            Importe quantos XMLs forem necessários, pesquise documentos, confira as tags fiscais e abra cada NFC-e
            em uma visualização DANFE para conferência. O processamento e o armazenamento permanecem locais no navegador.
          </p>
        </div>
        <div className="nfce-import-summary">
          <div className="workspace-storage-state nfce-storage-state">
            <i />
            <span>{storageMessage}</span>
          </div>
          <div className="workspace-import-counter nfce-import-counter">
            <strong>{documents.length.toLocaleString('pt-BR')}</strong>
            <span>XMLs carregados</span>
          </div>
        </div>
      </section>

      <section
        className={'workspace-dropzone nfce-dropzone ' + (dragging ? 'dragging' : '')}
        onDragOver={event => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          void handleFiles(Array.from(event.dataTransfer.files))
        }}
        onClick={() => storageReady && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (storageReady && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={event => {
            if (event.target.files) void handleFiles(Array.from(event.target.files))
            event.currentTarget.value = ''
          }}
        />
        <div className="workspace-drop-icon nfce-drop-icon">XML</div>
        <div>
          <strong>{!storageReady ? 'Restaurando arquivos NFC-e…' : busy ? 'Processando arquivos NFC-e…' : 'Arraste os XMLs aqui ou clique para selecionar'}</strong>
          <span>Arquivos XML exclusivamente · NFC-e modelo 65 · sem limite fixo no PrimeCheck · armazenamento local por IP</span>
        </div>
        {busy && (
          <div className="nfce-progress" aria-live="polite">
            <span style={{ width: progress.total ? `${progress.current / progress.total * 100}%` : '0%' }} />
            <small>{progress.current.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}</small>
          </div>
        )}
      </section>

      {errors.length > 0 && (
        <div className="workspace-import-errors">
          {errors.slice(0, 8).map((error, index) => <span key={error + index}>{error}</span>)}
          {errors.length > 8 && <span>+ {errors.length - 8} ocorrências adicionais.</span>}
        </div>
      )}

      <section className="nfce-kpis">
        <article><span>Importadas</span><strong>{documents.length.toLocaleString('pt-BR')}</strong><small>arquivos XML</small></article>
        <article className="ok"><span>Autorizadas</span><strong>{authorized.toLocaleString('pt-BR')}</strong><small>cStat 100</small></article>
        <article className={issues ? 'warning' : ''}><span>Atenções</span><strong>{issues.toLocaleString('pt-BR')}</strong><small>XML/status a revisar</small></article>
        <article><span>Valor total</span><strong>{formatNfceMoney(totalValue)}</strong><small>soma de vNF</small></article>
      </section>

      <section className="nfce-list-card">
        <div className="nfce-toolbar">
          <div>
            <span className="eyebrow">DOCUMENTOS IMPORTADOS</span>
            <h2>Lista de NFC-e</h2>
          </div>
          <div className="nfce-toolbar-actions">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar chave, número, emissor, CNPJ, protocolo..."
              aria-label="Pesquisar NFC-e"
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="ALL">Todas</option>
              <option value="AUTHORIZED">Autorizadas</option>
              <option value="ISSUES">Com atenção</option>
            </select>
            {documents.length > 0 && (
              <button
                className="button ghost"
                type="button"
                disabled={busy || !storageReady}
                onClick={() => void removeAll()}
              >
                Limpar XMLs importados
              </button>
            )}
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="nfce-empty">
            <strong>Nenhuma NFC-e importada.</strong>
            <span>Importe arquivos XML para listar, pesquisar, visualizar DANFE e inspecionar cada tag fiscal.</span>
          </div>
        ) : (
          <>
            <div className="nfce-table-wrap">
              <table className="nfce-table">
                <thead>
                  <tr>
                    <th>Nº / Série</th>
                    <th>Emissor</th>
                    <th>Emissão</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Chave de acesso</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(item => (
                    <tr key={item.id} onDoubleClick={() => openDocument(item)}>
                      <td><strong>{item.number || '—'}</strong><small>Série {item.series || '—'}</small></td>
                      <td><strong>{item.issuerName || 'Não identificado'}</strong><small>{item.issuerDocument || item.fileName}</small></td>
                      <td>{formatNfceDate(item.issueDate)}</td>
                      <td><strong>{formatNfceMoney(item.total)}</strong><small>{item.itemCount} {item.itemCount === 1 ? 'item' : 'itens'}</small></td>
                      <td><span className={'nfce-status ' + statusClass(item)}>{statusLabel(item)}</span></td>
                      <td><code>{formatAccessKey(item.accessKey) || '—'}</code></td>
                      <td><button className="button secondary nfce-open" type="button" onClick={() => openDocument(item)}>Abrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination nfce-pagination">
              <span>{filtered.length.toLocaleString('pt-BR')} registros</span>
              <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
              <button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹</button>
              <span>Página {page} de {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>›</button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </>
        )}
      </section>

      {selected && detail && (
        <div className="nfce-modal-overlay" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setSelected(null)
        }}>
          <section className="nfce-modal" role="dialog" aria-modal="true" aria-label={'NFC-e ' + (selected.number || selected.fileName)}>
            <header className="nfce-modal-header">
              <div>
                <span className="eyebrow">NFC-e · {selected.environment}</span>
                <h2>Nota {selected.number || '—'} · Série {selected.series || '—'}</h2>
                <p>{selected.issuerName || selected.fileName}</p>
              </div>
              <div className="nfce-modal-header-actions">
                <button className="button secondary" type="button" onClick={printDanfe}>Imprimir / salvar PDF</button>
                <button className="icon-button large" type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
              </div>
            </header>

            <nav className="nfce-modal-tabs">
              <button type="button" className={modalTab === 'danfe' ? 'active' : ''} onClick={() => setModalTab('danfe')}>DANFE NFC-e</button>
              <button type="button" className={modalTab === 'tags' ? 'active' : ''} onClick={() => setModalTab('tags')}>Tags XML</button>
              <button type="button" className={modalTab === 'xml' ? 'active' : ''} onClick={() => setModalTab('xml')}>XML bruto</button>
            </nav>

            <div className="nfce-modal-body">
              {modalTab === 'danfe' && (
                <article className="nfce-danfe" id="nfce-danfe-print">
                  <div className="nfce-danfe-title">
                    <div>
                      <strong>{detail.issuerName || 'Emitente não identificado'}</strong>
                      <span>{detail.issuerAddress || 'Endereço não informado no XML'}</span>
                      <span>CNPJ/CPF: {detail.issuerDocument || '—'}</span>
                    </div>
                    <div>
                      <b>DANFE NFC-e</b>
                      <span>Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</span>
                      <strong>Nº {detail.number || '—'} · Série {detail.series || '—'}</strong>
                    </div>
                  </div>

                  <div className="nfce-danfe-key">
                    <span>CHAVE DE ACESSO</span>
                    <strong>{formatAccessKey(detail.accessKey) || 'Não identificada'}</strong>
                  </div>

                  <div className="nfce-danfe-meta">
                    <div><span>Emissão</span><strong>{formatNfceDate(detail.issueDate)}</strong></div>
                    <div><span>Protocolo</span><strong>{detail.protocol || '—'}</strong></div>
                    <div><span>Status</span><strong>{detail.statusCode || '—'} {detail.statusMessage}</strong></div>
                    <div><span>Natureza da operação</span><strong>{detail.natureOperation || '—'}</strong></div>
                  </div>

                  <div className="nfce-danfe-consumer">
                    <span>CONSUMIDOR</span>
                    <strong>{detail.recipientName || 'Consumidor não identificado'}</strong>
                    <small>{detail.recipientDocument || 'Documento não informado'} {detail.recipientAddress ? ' · ' + detail.recipientAddress : ''}</small>
                  </div>

                  <div className="nfce-danfe-items">
                    <table>
                      <thead><tr><th>#</th><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Un.</th><th>Vl. unit.</th><th>Total</th></tr></thead>
                      <tbody>
                        {detail.items.map(item => (
                          <tr key={item.index || item.code + item.description}>
                            <td>{item.index}</td>
                            <td>{item.code}</td>
                            <td><strong>{item.description}</strong><small>NCM {item.ncm || '—'} · CFOP {item.cfop || '—'}{item.cest ? ' · CEST ' + item.cest : ''}</small></td>
                            <td>{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                            <td>{item.unit}</td>
                            <td>{formatNfceMoney(item.unitPrice)}</td>
                            <td>{formatNfceMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="nfce-danfe-bottom">
                    <div className="nfce-danfe-payments">
                      <span>PAGAMENTOS</span>
                      {detail.payments.length
                        ? detail.payments.map((payment, index) => (
                            <div key={payment.methodCode + index}><strong>{payment.methodLabel}</strong><b>{formatNfceMoney(payment.amount)}</b></div>
                          ))
                        : <small>Nenhuma forma de pagamento identificada.</small>}
                      {detail.change > 0 && <div><strong>Troco</strong><b>{formatNfceMoney(detail.change)}</b></div>}
                    </div>
                    <div className="nfce-danfe-totals">
                      <div><span>Produtos</span><strong>{formatNfceMoney(detail.productsTotal)}</strong></div>
                      <div><span>Desconto</span><strong>{formatNfceMoney(detail.discount)}</strong></div>
                      <div><span>Tributos aprox.</span><strong>{formatNfceMoney(detail.taxesTotal)}</strong></div>
                      <div className="total"><span>VALOR TOTAL</span><strong>{formatNfceMoney(detail.total)}</strong></div>
                    </div>
                  </div>

                  {detail.qrCodeUrl && (
                    <div className="nfce-danfe-qr">
                      <div className="nfce-qr-placeholder">QR</div>
                      <div>
                        <span>CONSULTA VIA QR CODE</span>
                        <a href={detail.qrCodeUrl} target="_blank" rel="noreferrer">Abrir endereço de consulta informado no XML</a>
                        <small>{detail.qrCodeUrl}</small>
                      </div>
                    </div>
                  )}

                  {detail.additionalInfo && (
                    <div className="nfce-danfe-additional">
                      <span>INFORMAÇÕES ADICIONAIS</span>
                      <p>{detail.additionalInfo}</p>
                    </div>
                  )}

                  <footer className="nfce-danfe-disclaimer">
                    Visualização gerada pelo PrimeCheck exclusivamente para conferência do XML importado.
                  </footer>
                </article>
              )}

              {modalTab === 'tags' && (
                <section className="nfce-tags-view">
                  <div className="nfce-tag-search">
                    <div>
                      <span className="eyebrow">ESTRUTURA XML ORIGINAL</span>
                      <h3>Pesquisar e inspecionar todas as tags</h3>
                      <p>
                        Expanda a árvore clicando nas linhas. Tags vazias também são exibidas para manter
                        a estrutura original do arquivo importado.
                      </p>
                    </div>
                    <div className="nfce-tag-search-field">
                      <input
                        type="search"
                        value={tagSearch}
                        onChange={event => setTagSearch(event.target.value)}
                        placeholder="Pesquisar tag, valor, atributo ou caminho..."
                        autoFocus
                      />
                      {tagSearch && (
                        <button type="button" onClick={() => setTagSearch('')} aria-label="Limpar pesquisa">×</button>
                      )}
                    </div>
                  </div>

                  {normalizedTagSearch && (
                    <div className="nfce-tag-results">
                      <div className="nfce-tag-results-head">
                        <strong>{xmlMatches.length.toLocaleString('pt-BR')} resultado{xmlMatches.length === 1 ? '' : 's'}</strong>
                        <span>Clique em um resultado para abrir o caminho na árvore XML.</span>
                      </div>
                      {xmlMatches.length > 0 ? (
                        <div className="nfce-tag-results-list">
                          {xmlMatches.slice(0, 200).map(entry => (
                            <button
                              type="button"
                              key={entry.key}
                              className={selectedXmlKey === entry.key ? 'active' : ''}
                              onClick={() => revealXmlEntry(entry)}
                            >
                              <code>&lt;{entry.name}&gt;</code>
                              <span className={entry.value || entry.attributes ? 'has-value' : ''}>
                                {entry.value || entry.attributes || 'sem conteúdo'}
                              </span>
                              <small>{entry.path}</small>
                            </button>
                          ))}
                          {xmlMatches.length > 200 && (
                            <div className="nfce-tag-results-limit">
                              Exibindo os primeiros 200 resultados de {xmlMatches.length.toLocaleString('pt-BR')}.
                              Refine a pesquisa para localizar a informação desejada.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="nfce-tag-no-results">
                          Nenhuma tag, valor, atributo ou caminho encontrado para “{tagSearch}”.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="nfce-xml-tree" ref={xmlTreeRef}>
                    {rootElement && (
                      <XmlNode
                        element={rootElement}
                        path={'/' + elementName(rootElement)}
                        nodeKey="0"
                        searchQuery={normalizedTagSearch}
                        selectedKey={selectedXmlKey}
                        revealKey={revealXmlKey}
                      />
                    )}
                  </div>
                </section>
              )}

              {modalTab === 'xml' && (
                <section className="nfce-raw-view">
                  <div className="nfce-raw-head">
                    <div>
                      <span className="eyebrow">ARQUIVO ORIGINAL</span>
                      <h3>{selected.fileName}</h3>
                    </div>
                    <button className="button secondary" type="button" onClick={() => void copyXml()}>Copiar XML</button>
                  </div>
                  <pre>{selected.rawXml}</pre>
                </section>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
