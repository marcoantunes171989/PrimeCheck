import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import {
  formatAccessKey,
  formatNfceDate,
  formatNfceDocument,
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
  loadNfceUiState,
  saveNfceDocuments,
  saveNfceUiState,
  type NfceModalTab,
  type NfceSortDirection,
  type NfceSortKey,
  type NfceStatusFilter,
  type NfceUiState,
} from '../lib/workspaceStorage'
import '../nfce.css'

const PAGE_SIZE = 20
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

const ancestorKeys = (key: string) => {
  const parts = key.split('-')
  const keys: string[] = []
  for (let index = 1; index < parts.length; index += 1) {
    keys.push(parts.slice(0, index).join('-'))
  }
  return keys
}

const copyPlainText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }
}

const XmlNode = ({
  element,
  path,
  nodeKey,
  searchQuery,
  selectedKey,
  expandedKeys,
  copiedKey,
  depth = 0,
  onToggle,
  onCopyValue,
}: {
  element: Element
  path: string
  nodeKey: string
  searchQuery: string
  selectedKey: string | null
  expandedKeys: Set<string>
  copiedKey: string | null
  depth?: number
  onToggle: (key: string) => void
  onCopyValue: (key: string, value: string) => void
}) => {
  const children = Array.from(element.children)
  const name = elementName(element)
  const value = directText(element)
  const attributes = Array.from(element.attributes)
  const empty = children.length === 0 && !value
  const expanded = children.length > 0 && expandedKeys.has(nodeKey)
  const matched = Boolean(searchQuery && elementOwnSearchText(element, path).includes(searchQuery))
  const selected = selectedKey === nodeKey

  const handleRowClick = () => {
    if (children.length) onToggle(nodeKey)
  }

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!children.length) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle(nodeKey)
    }
  }

  const handleCopy = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onCopyValue(nodeKey, value)
  }

  return (
    <div className="nfce-xml-node" id={`nfce-xml-node-${nodeKey}`}>
      <div
        className={[
          'nfce-xml-node-head',
          children.length ? 'is-branch' : 'is-leaf',
          matched ? 'is-match' : '',
          selected ? 'is-selected' : '',
        ].filter(Boolean).join(' ')}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        role={children.length ? 'button' : undefined}
        tabIndex={children.length ? 0 : undefined}
        aria-expanded={children.length ? expanded : undefined}
        title={path}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
      >
        <span className="nfce-xml-chevron" aria-hidden="true">
          {children.length ? (expanded ? '⌄' : '›') : '·'}
        </span>
        <code className="nfce-xml-tag">{empty ? `<${name} />` : `<${name}>`}</code>
        {value ? (
          <button
            type="button"
            className={'nfce-xml-value' + (copiedKey === nodeKey ? ' is-copied' : '')}
            onClick={handleCopy}
            title="Copiar valor"
          >
            <span className="nfce-xml-value-text">{value}</span>
            {copiedKey === nodeKey && <span className="nfce-xml-copied" role="status">Valor copiado</span>}
          </button>
        ) : empty ? (
          <em>sem conteúdo</em>
        ) : null}
        {!empty && children.length === 0 && <code className="nfce-xml-tag nfce-xml-tag-close">{`</${name}>`}</code>}
        {attributes.length > 0 && (
          <small className="nfce-xml-attrs">{attributes.map(attr => `${attr.name}="${attr.value}"`).join(' ')}</small>
        )}
      </div>

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
                expandedKeys={expandedKeys}
                copiedKey={copiedKey}
                depth={depth + 1}
                onToggle={onToggle}
                onCopyValue={onCopyValue}
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

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

const issueTimestamp = (item: NfceSummary) => {
  const timestamp = Date.parse(item.issueDate)
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

const issueDayKey = (item: NfceSummary) => {
  const timestamp = Date.parse(item.issueDate)
  if (!Number.isFinite(timestamp)) return 'sem-data'
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const issueDayLabel = (key: string) => {
  if (key === 'sem-data') return 'Sem data de emissão'
  const [year, month, day] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

const compareNfce = (
  left: NfceSummary,
  right: NfceSummary,
  sortKey: NfceSortKey,
  direction: NfceSortDirection,
) => {
  const factor = direction === 'asc' ? 1 : -1
  let result = 0

  switch (sortKey) {
    case 'number':
      result = collator.compare(`${left.number} ${left.series}`, `${right.number} ${right.series}`)
      break
    case 'issuer':
      result = collator.compare(`${left.issuerName} ${left.issuerDocument}`, `${right.issuerName} ${right.issuerDocument}`)
      break
    case 'issueDate':
      result = issueTimestamp(left) - issueTimestamp(right)
      break
    case 'total':
      result = left.total - right.total
      break
    case 'status':
      result = collator.compare(statusLabel(left), statusLabel(right))
      break
    case 'accessKey':
      result = collator.compare(left.accessKey, right.accessKey)
      break
  }

  if (result === 0 && sortKey !== 'issueDate') {
    result = issueTimestamp(left) - issueTimestamp(right)
  }
  return result * factor
}

const defaultUiState = (): NfceUiState => ({
  selectedId: null,
  modalOpen: false,
  modalTab: 'danfe',
  listSearch: '',
  statusFilter: 'ALL',
  sortKey: 'issueDate',
  sortDirection: 'asc',
  page: 1,
  tagSearch: '',
  selectedXmlKey: null,
  expandedXmlKeys: ['0'],
  xmlTreeScrollTop: 0,
  modalScrollTop: 0,
  pageScrollY: 0,
})

export default function NfceValidatorPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const xmlTreeRef = useRef<HTMLDivElement>(null)
  const modalBodyRef = useRef<HTMLDivElement>(null)
  const restoringRef = useRef(true)
  const skipPageResetRef = useRef(true)
  const skipSearchRevealRef = useRef(true)
  const copyTimeoutRef = useRef<number>(0)
  const latestUiRef = useRef<NfceUiState>(defaultUiState())
  const pendingRestoreRef = useRef<NfceUiState | null>(null)

  const [documents, setDocuments] = useState<NfceSummary[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<NfceStatusFilter>('ALL')
  const [sortKey, setSortKey] = useState<NfceSortKey>('issueDate')
  const [sortDirection, setSortDirection] = useState<NfceSortDirection>('asc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<NfceSummary | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<NfceModalTab>('danfe')
  const [tagSearch, setTagSearch] = useState('')
  const [selectedXmlKey, setSelectedXmlKey] = useState<string | null>(null)
  const [expandedXmlKeys, setExpandedXmlKeys] = useState<string[]>(['0'])
  const [copiedXmlKey, setCopiedXmlKey] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [storageScoped, setStorageScoped] = useState(false)
  const [storageMessage, setStorageMessage] = useState('Restaurando XMLs salvos para este IP…')

  const detail = useMemo(() => selected ? parseNfceDetail(selected) : null, [selected])
  const expandedXmlKeySet = useMemo(() => new Set(expandedXmlKeys), [expandedXmlKeys])

  useEffect(() => {
    let active = true

    void (async () => {
      const scope = await initializeWorkspaceScope()
      if (!active) return

      if (!scope) {
        setStorageScoped(false)
        setStorageMessage('Não foi possível identificar o IP atual. Os XMLs desta sessão não serão restaurados após fechar ou atualizar a página.')
        restoringRef.current = false
        skipPageResetRef.current = false
        skipSearchRevealRef.current = false
        setStorageReady(true)
        return
      }

      setStorageScoped(true)
      const stored = await loadNfceDocuments()
      if (!active) return

      const ui = loadNfceUiState()
      setDocuments(stored)
      setSearch(ui.listSearch)
      setStatusFilter(ui.statusFilter)
      setSortKey(ui.sortKey)
      setSortDirection(ui.sortDirection)
      setPage(ui.page)
      setModalTab(ui.modalTab)
      setTagSearch(ui.tagSearch)
      setSelectedXmlKey(ui.selectedXmlKey)
      setExpandedXmlKeys(ui.expandedXmlKeys.length ? ui.expandedXmlKeys : ['0'])
      setActiveDocumentId(ui.selectedId)

      const found = ui.selectedId ? stored.find(item => item.id === ui.selectedId) ?? null : null
      if (found && ui.modalOpen) setSelected(found)
      pendingRestoreRef.current = ui

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
    if (skipPageResetRef.current) return
    setPage(1)
  }, [search, statusFilter, sortKey, sortDirection])

  useEffect(() => {
    if (!storageReady) return
    const pending = pendingRestoreRef.current
    if (!pending) {
      restoringRef.current = false
      skipPageResetRef.current = false
      skipSearchRevealRef.current = false
      return
    }

    let cancelled = false
    const restore = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return
        window.scrollTo(0, pending.pageScrollY)
        if (modalBodyRef.current) modalBodyRef.current.scrollTop = pending.modalScrollTop
        if (xmlTreeRef.current) xmlTreeRef.current.scrollTop = pending.xmlTreeScrollTop
        pendingRestoreRef.current = null
        restoringRef.current = false
        skipPageResetRef.current = false
        skipSearchRevealRef.current = false
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(restore)
    }
  }, [storageReady, selected, modalTab])

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

  const sortedFiltered = useMemo(() => {
    const groups = new Map<string, NfceSummary[]>()
    filtered.forEach(item => {
      const key = issueDayKey(item)
      const current = groups.get(key) ?? []
      current.push(item)
      groups.set(key, current)
    })

    const dateKeys = [...groups.keys()].sort((left, right) => {
      if (left === 'sem-data') return 1
      if (right === 'sem-data') return -1
      const result = collator.compare(left, right)
      return sortKey === 'issueDate' && sortDirection === 'desc' ? -result : result
    })

    return dateKeys.flatMap(key => {
      const rows = groups.get(key) ?? []
      if (sortKey === 'issueDate') {
        return rows.sort((left, right) => compareNfce(left, right, 'issueDate', sortDirection))
      }
      return rows.sort((left, right) => compareNfce(left, right, sortKey, sortDirection))
    })
  }, [filtered, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: NfceSummary[] }> = []
    pageItems.forEach(item => {
      const key = issueDayKey(item)
      const current = groups[groups.length - 1]
      if (!current || current.key !== key) {
        groups.push({ key, label: issueDayLabel(key), items: [item] })
      } else {
        current.items.push(item)
      }
    })
    return groups
  }, [pageItems])

  const toggleSort = (key: NfceSortKey) => {
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const sortIndicator = (key: NfceSortKey) =>
    sortKey === key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'
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
      setActiveDocumentId(null)
      setTagSearch('')
      setSelectedXmlKey(null)
      setExpandedXmlKeys(['0'])
      setPage(1)
      setStorageMessage('Arquivos XML importados removidos para este IP.')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao limpar o armazenamento local.'
      setErrors(current => [...current, reason])
    }
  }

  const openDocument = (item: NfceSummary) => {
    const same = selected?.id === item.id || activeDocumentId === item.id
    setSelected(item)
    setActiveDocumentId(item.id)
    if (!same) {
      setTagSearch('')
      setSelectedXmlKey(null)
      setExpandedXmlKeys(['0'])
      if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0
      if (xmlTreeRef.current) xmlTreeRef.current.scrollTop = 0
    }
  }

  const closeDocument = () => setSelected(null)

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

  const toggleXmlNode = (key: string) => {
    setExpandedXmlKeys(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key],
    )
  }

  const revealXmlEntry = (entry: XmlSearchEntry) => {
    setSelectedXmlKey(entry.key)
    setExpandedXmlKeys(current => [...new Set([...current, ...ancestorKeys(entry.key)])])

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
    if (skipSearchRevealRef.current) return
    if (!normalizedTagSearch) {
      setSelectedXmlKey(null)
      return
    }
    const firstMatch = xmlMatches[0]
    if (firstMatch) revealXmlEntry(firstMatch)
  }, [normalizedTagSearch, xmlMatches])

  const copyXmlValue = async (key: string, value: string) => {
    setCopiedXmlKey(key)
    window.clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedXmlKey(current => current === key ? null : current)
    }, 1400)
    await copyPlainText(value)
  }

  useEffect(() => () => window.clearTimeout(copyTimeoutRef.current), [])

  const currentUiState = (): NfceUiState => ({
    selectedId: selected?.id ?? activeDocumentId,
    modalOpen: Boolean(selected),
    modalTab,
    listSearch: search,
    statusFilter,
    sortKey,
    sortDirection,
    page: safePage,
    tagSearch,
    selectedXmlKey,
    expandedXmlKeys,
    xmlTreeScrollTop: xmlTreeRef.current?.scrollTop ?? latestUiRef.current.xmlTreeScrollTop,
    modalScrollTop: modalBodyRef.current?.scrollTop ?? latestUiRef.current.modalScrollTop,
    pageScrollY: window.scrollY,
  })

  latestUiRef.current = currentUiState()

  useEffect(() => {
    if (!storageReady || !storageScoped || restoringRef.current) return
    const timer = window.setTimeout(() => {
      saveNfceUiState(latestUiRef.current)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [
    storageReady,
    storageScoped,
    selected,
    activeDocumentId,
    modalTab,
    search,
    statusFilter,
    sortKey,
    sortDirection,
    safePage,
    tagSearch,
    selectedXmlKey,
    expandedXmlKeys,
  ])

  useEffect(() => {
    if (!storageReady || !storageScoped) return
    const persist = () => saveNfceUiState(latestUiRef.current)
    const handleScroll = () => {
      latestUiRef.current = {
        ...latestUiRef.current,
        xmlTreeScrollTop: xmlTreeRef.current?.scrollTop ?? latestUiRef.current.xmlTreeScrollTop,
        modalScrollTop: modalBodyRef.current?.scrollTop ?? latestUiRef.current.modalScrollTop,
        pageScrollY: window.scrollY,
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('beforeunload', persist)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('beforeunload', persist)
      persist()
    }
  }, [storageReady, storageScoped])

  const copyXml = async () => {
    if (!selected) return
    await copyPlainText(selected.rawXml)
  }

  const printDanfe = () => {
    setModalTab('danfe')
    window.setTimeout(() => window.print(), 50)
  }

  const accessKeyGroups = formatAccessKey(detail?.accessKey || '').split(' ').filter(Boolean)

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
          <div className="nfce-toolbar-heading">
            <div>
              <span className="eyebrow">DOCUMENTOS IMPORTADOS</span>
              <h2>Lista de NFC-e</h2>
            </div>
            <small>20 registros por página · agrupamento automático por data de emissão</small>
          </div>
          <div className="nfce-toolbar-search">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar em todos os campos: número, série, emissor, CNPJ/CPF, data, valor, status, chave, protocolo..."
              aria-label="Pesquisar em todos os campos da NFC-e"
            />
          </div>
          <div className="nfce-toolbar-controls">
            <label>
              <span>Situação</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as NfceStatusFilter)}>
                <option value="ALL">Todas</option>
                <option value="AUTHORIZED">Autorizadas</option>
                <option value="ISSUES">Com atenção</option>
              </select>
            </label>
            <span className="nfce-sort-summary">
              Ordenação: {sortKey === 'issueDate' ? 'Emissão' : sortKey === 'number' ? 'Nº / Série' : sortKey === 'issuer' ? 'Emissor' : sortKey === 'total' ? 'Valor' : sortKey === 'status' ? 'Status' : 'Chave'} {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
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
                    <th><button type="button" className={sortKey === 'number' ? 'active' : ''} onClick={() => toggleSort('number')}>Nº / Série <span>{sortIndicator('number')}</span></button></th>
                    <th><button type="button" className={sortKey === 'issuer' ? 'active' : ''} onClick={() => toggleSort('issuer')}>Emissor <span>{sortIndicator('issuer')}</span></button></th>
                    <th><button type="button" className={sortKey === 'issueDate' ? 'active' : ''} onClick={() => toggleSort('issueDate')}>Emissão <span>{sortIndicator('issueDate')}</span></button></th>
                    <th><button type="button" className={sortKey === 'total' ? 'active' : ''} onClick={() => toggleSort('total')}>Valor <span>{sortIndicator('total')}</span></button></th>
                    <th><button type="button" className={sortKey === 'status' ? 'active' : ''} onClick={() => toggleSort('status')}>Status <span>{sortIndicator('status')}</span></button></th>
                    <th><button type="button" className={sortKey === 'accessKey' ? 'active' : ''} onClick={() => toggleSort('accessKey')}>Chave de acesso <span>{sortIndicator('accessKey')}</span></button></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageGroups.map(group => (
                    <Fragment key={group.key}>
                      <tr className="nfce-date-group-row">
                        <td colSpan={7}>
                          <span>{group.label}</span>
                          <strong>{group.items.length} {group.items.length === 1 ? 'documento' : 'documentos'} nesta página</strong>
                        </td>
                      </tr>
                      {group.items.map(item => (
                        <tr
                          key={item.id}
                          className={item.id === activeDocumentId ? 'is-active' : ''}
                          onDoubleClick={() => openDocument(item)}
                        >
                          <td><strong>{item.number || '—'}</strong><small>Série {item.series || '—'}</small></td>
                          <td><strong>{item.issuerName || 'Não identificado'}</strong><small>{item.issuerDocument || item.fileName}</small></td>
                          <td>{formatNfceDate(item.issueDate)}</td>
                          <td><strong>{formatNfceMoney(item.total)}</strong><small>{item.itemCount} {item.itemCount === 1 ? 'item' : 'itens'}</small></td>
                          <td><span className={'nfce-status ' + statusClass(item)}>{statusLabel(item)}</span></td>
                          <td><code>{formatAccessKey(item.accessKey) || '—'}</code></td>
                          <td><button className="button secondary nfce-open" type="button" onClick={() => openDocument(item)}>Abrir</button></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination nfce-pagination">
              <span>{filtered.length.toLocaleString('pt-BR')} registros</span>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹</button>
              <span>Página {safePage} de {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>›</button>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </>
        )}
      </section>

      {selected && detail && (
        <div className="nfce-modal-overlay" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeDocument()
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
                <button className="icon-button large" type="button" onClick={closeDocument} aria-label="Fechar">×</button>
              </div>
            </header>

            <nav className="nfce-modal-tabs">
              <button type="button" className={modalTab === 'danfe' ? 'active' : ''} onClick={() => setModalTab('danfe')}>DANFE NFC-e</button>
              <button type="button" className={modalTab === 'tags' ? 'active' : ''} onClick={() => setModalTab('tags')}>Tags XML</button>
              <button type="button" className={modalTab === 'xml' ? 'active' : ''} onClick={() => setModalTab('xml')}>XML bruto</button>
            </nav>

            <div
              className="nfce-modal-body"
              ref={modalBodyRef}
              onScroll={event => {
                latestUiRef.current = {
                  ...latestUiRef.current,
                  modalScrollTop: event.currentTarget.scrollTop,
                }
              }}
            >
              {modalTab === 'danfe' && (
                <article className="nfce-danfe" id="nfce-danfe-print">
                  <header className="nfce-danfe-head">
                    <div className="nfce-danfe-emit">
                      <span className="nfce-danfe-kicker">Emitente</span>
                      <strong>{detail.issuerName || 'Emitente não identificado'}</strong>
                      {detail.issuerFantasy && detail.issuerFantasy !== detail.issuerName && (
                        <em>{detail.issuerFantasy}</em>
                      )}
                      <p>{detail.issuerAddress || 'Endereço não informado no XML'}</p>
                      <div className="nfce-danfe-emit-ids">
                        <b>CNPJ/CPF {formatNfceDocument(detail.issuerDocument) || '—'}</b>
                        {detail.issuerIe && <b>IE {detail.issuerIe}</b>}
                        {detail.issuerPhone && <b>Fone {detail.issuerPhone}</b>}
                      </div>
                    </div>
                    <div className="nfce-danfe-badge">
                      <span>Documento auxiliar</span>
                      <b>DANFE NFC-e</b>
                      <small>Nota Fiscal de Consumidor Eletrônica</small>
                      <div className="nfce-danfe-number">
                        <div>
                          <span>Número</span>
                          <strong>{detail.number || '—'}</strong>
                        </div>
                        <div>
                          <span>Série</span>
                          <strong>{detail.series || '—'}</strong>
                        </div>
                      </div>
                    </div>
                  </header>

                  <div className="nfce-danfe-key">
                    <span>Chave de acesso</span>
                    <strong className="nfce-danfe-key-digits">
                      {accessKeyGroups.length
                        ? accessKeyGroups.map((group, index) => <span key={group + index}>{group}</span>)
                        : 'Não identificada'}
                    </strong>
                  </div>

                  <div className="nfce-danfe-meta">
                    <div>
                      <span>Emissão</span>
                      <strong>{formatNfceDate(detail.issueDate)}</strong>
                    </div>
                    <div>
                      <span>Protocolo</span>
                      <strong>{detail.protocol || '—'}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong className={'nfce-danfe-status ' + statusClass(detail)}>{statusLabel(detail)}</strong>
                      <small>{detail.statusCode || '—'}{detail.statusMessage ? ` · ${detail.statusMessage}` : ''}</small>
                    </div>
                    <div>
                      <span>Natureza da operação</span>
                      <strong>{detail.natureOperation || '—'}</strong>
                    </div>
                  </div>

                  <div className="nfce-danfe-consumer">
                    <span className="nfce-danfe-kicker">Consumidor</span>
                    <strong>{detail.recipientName || 'Consumidor não identificado'}</strong>
                    <small>
                      {detail.recipientDocument ? formatNfceDocument(detail.recipientDocument) : 'Documento não informado'}
                      {detail.recipientAddress ? ` · ${detail.recipientAddress}` : ''}
                    </small>
                  </div>

                  <div className="nfce-danfe-items">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Código</th>
                          <th>Descrição</th>
                          <th>Qtd.</th>
                          <th>Un.</th>
                          <th>Vl. unit.</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map(item => (
                          <tr key={item.index || item.code + item.description}>
                            <td>{item.index}</td>
                            <td>{item.code}</td>
                            <td>
                              <strong>{item.description}</strong>
                              <small>NCM {item.ncm || '—'} · CFOP {item.cfop || '—'}{item.cest ? ' · CEST ' + item.cest : ''}</small>
                            </td>
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
                      <span className="nfce-danfe-kicker">Pagamentos</span>
                      {detail.payments.length
                        ? detail.payments.map((payment, index) => (
                            <div key={payment.methodCode + index}>
                              <strong>{payment.methodLabel}</strong>
                              <b>{formatNfceMoney(payment.amount)}</b>
                            </div>
                          ))
                        : <small>Nenhuma forma de pagamento identificada.</small>}
                      {detail.change > 0 && (
                        <div className="nfce-danfe-change">
                          <strong>Troco</strong>
                          <b>{formatNfceMoney(detail.change)}</b>
                        </div>
                      )}
                    </div>
                    <div className="nfce-danfe-totals">
                      <span className="nfce-danfe-kicker">Totais</span>
                      <div><span>Produtos</span><strong>{formatNfceMoney(detail.productsTotal)}</strong></div>
                      <div><span>Desconto</span><strong>{formatNfceMoney(detail.discount)}</strong></div>
                      <div><span>Tributos aprox.</span><strong>{formatNfceMoney(detail.taxesTotal)}</strong></div>
                      <div className="total"><span>Valor total</span><strong>{formatNfceMoney(detail.total)}</strong></div>
                    </div>
                  </div>

                  {(detail.qrCodeUrl || detail.consumerUrl) && (
                    <div className="nfce-danfe-qr">
                      <div className="nfce-qr-mark" aria-hidden="true">
                        <span /><span /><span /><span />
                      </div>
                      <div>
                        <span className="nfce-danfe-kicker">Consulta</span>
                        <strong>Consulta pública da NFC-e</strong>
                        {detail.qrCodeUrl && (
                          <a href={detail.qrCodeUrl} target="_blank" rel="noreferrer">Abrir endereço de consulta informado no XML</a>
                        )}
                        {detail.consumerUrl && detail.consumerUrl !== detail.qrCodeUrl && (
                          <a href={detail.consumerUrl} target="_blank" rel="noreferrer">Portal do consumidor</a>
                        )}
                        <small>{detail.qrCodeUrl || detail.consumerUrl}</small>
                      </div>
                    </div>
                  )}

                  {detail.additionalInfo && (
                    <div className="nfce-danfe-additional">
                      <span className="nfce-danfe-kicker">Informações adicionais</span>
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
                        Expanda a árvore clicando nas linhas. Clique no valor laranja para copiar apenas o conteúdo
                        da tag. Tags vazias também são exibidas para manter a estrutura original do arquivo.
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

                  <div
                    className="nfce-xml-tree"
                    ref={xmlTreeRef}
                    onScroll={event => {
                      latestUiRef.current = {
                        ...latestUiRef.current,
                        xmlTreeScrollTop: event.currentTarget.scrollTop,
                      }
                    }}
                  >
                    {rootElement && (
                      <XmlNode
                        element={rootElement}
                        path={'/' + elementName(rootElement)}
                        nodeKey="0"
                        searchQuery={normalizedTagSearch}
                        selectedKey={selectedXmlKey}
                        expandedKeys={expandedXmlKeySet}
                        copiedKey={copiedXmlKey}
                        onToggle={toggleXmlNode}
                        onCopyValue={(key, value) => void copyXmlValue(key, value)}
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
