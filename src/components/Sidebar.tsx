import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { WORKSPACE_GROUPS, WORKSPACE_MODULES, type WorkspaceGroupId, type WorkspaceModuleDefinition } from '../config/workspaceModules'

type Props = {
  active: string
  collapsed: boolean
  onToggle: () => void
  pinned: boolean
  onTogglePin: () => void
  onChange: (module: string) => void
  enabledWorkspaceModules: string[]
  hasWorkspaceData: boolean
}

type IconName =
  | 'chart'
  | 'folder'
  | 'shield'
  | 'import'
  | 'list'
  | 'partners'
  | 'structure'
  | 'products'
  | 'fiscal'
  | 'clients'
  | 'suppliers'
  | 'carriers'
  | 'cnpj'
  | 'ie'
  | 'search'
  | 'pin'
  | 'menu'
  | 'chevronRight'
  | 'chevronDown'

type NavKind = 'item' | 'group'

type NavEntry = {
  key: string
  kind: NavKind
  target: string
  enabled: boolean
  groupId?: WorkspaceGroupId | 'nfce'
  scope?: 'dashboard' | 'data' | 'validation'
}

const GROUP_ICONS: Record<WorkspaceGroupId, IconName> = {
  partners: 'partners',
  structure: 'structure',
  products: 'products',
  fiscal: 'fiscal',
}

const DASHBOARD_ICONS: Record<string, IconName> = {
  clients: 'clients',
  suppliers: 'suppliers',
  carriers: 'carriers',
}

const DASHBOARD_GROUP_META: Record<WorkspaceGroupId, { label: string; helper: string }> = {
  partners: { label: 'Parceiros', helper: 'Clientes, fornecedores e transportadoras' },
  structure: { label: 'Classificação Mercadológica', helper: 'Seções, grupos e subgrupos' },
  products: { label: 'Produtos', helper: 'Cadastro, loja, barras e vínculos' },
  fiscal: { label: 'Fiscal e Conteúdo', helper: 'NCM, CEST, tributos e conteúdo' },
}

const FIXED_FILES = [
  { id: 'importacao', label: 'Importação', helper: 'Quantidade livre', icon: 'import' as const },
  { id: 'internal-products', label: 'Lista de Produtos Internos', helper: 'Código e descrição', icon: 'list' as const },
]

const VALIDATION_ITEMS = [
  { id: 'cnpj', label: 'Validação CNPJ', helper: 'Consulta e dígitos', icon: 'cnpj' as const },
  { id: 'ie', label: 'Validação I.E.', helper: '27 UFs', icon: 'ie' as const },
]

const NFCE_MENU = { id: 'nfce', label: 'Validação NFC-e', helper: 'Documentos e análises', icon: 'fiscal' as const }
const NFCE_CHILDREN = [
  { id: 'nfce:documents', label: 'Documentos NFC-e' },
  { id: 'nfce:overview', label: 'Visão Geral' },
  { id: 'nfce:products', label: 'Produtos mais vendidos' },
  { id: 'nfce:consumers', label: 'Consumidores' },
  { id: 'nfce:barcodes', label: 'Pesquisa por produtos' },
]

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')

const compactWord = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLocaleLowerCase('pt-BR')

const matchesQuery = (query: string, ...parts: Array<string | undefined>) => {
  if (!query) return true
  const queryTokens = query.split(' ').filter(Boolean)
  const haystackTokens = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .flatMap(field => field.split(/\s+/).map(compactWord).filter(Boolean))

  if (haystackTokens.length === 0 || queryTokens.length === 0) return false

  return queryTokens.every(token =>
    haystackTokens.some(word =>
      word === token ||
      word.startsWith(token) ||
      (token.length >= 3 && word.includes(token)),
    ),
  )
}

const Glyph = ({ name }: { name: IconName }) => {
  const paths: Record<IconName, ReactNode> = {
    chart: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V6" />
        <path d="M17 16v-4" />
      </>
    ),
    folder: <path d="M4 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />,
    shield: (
      <>
        <path d="M12 3l8 3v6c0 5-3.5 8.2-8 9.5C7.5 20.2 4 17 4 12V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    import: (
      <>
        <path d="M12 16V6" />
        <path d="M8 10l4-4 4 4" />
        <path d="M5 19h14" />
      </>
    ),
    list: (
      <>
        <path d="M9 7h11" />
        <path d="M9 12h11" />
        <path d="M9 17h11" />
        <path d="M5 7h.01" />
        <path d="M5 12h.01" />
        <path d="M5 17h.01" />
      </>
    ),
    partners: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <path d="M17 11a2.5 2.5 0 1 0-1-4.8" />
        <path d="M21 19a5 5 0 0 0-4-4.9" />
      </>
    ),
    structure: (
      <>
        <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" />
        <path d="M4 13l8 4.5 8-4.5" />
        <path d="M4 17.5L12 22l8-4.5" />
      </>
    ),
    products: (
      <>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        <path d="M12 12l8-4.5" />
        <path d="M12 12v9" />
        <path d="M12 12L4 7.5" />
      </>
    ),
    fiscal: (
      <>
        <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M14 4v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </>
    ),
    clients: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19a7 7 0 0 1 14 0" />
      </>
    ),
    suppliers: (
      <>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M9 20v-6h6v6" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
      </>
    ),
    carriers: (
      <>
        <path d="M3 8h12v9H3z" />
        <path d="M15 12h3.5L21 15v2h-6" />
        <circle cx="7.5" cy="18.5" r="1.7" />
        <circle cx="17" cy="18.5" r="1.7" />
      </>
    ),
    cnpj: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h3" />
      </>
    ),
    ie: (
      <>
        <path d="M9 4h6v3H9z" />
        <rect x="6" y="6" width="12" height="14" rx="2" />
        <path d="M9 13l2 2 4-4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-3.6-3.6" />
      </>
    ),
    pin: (
      <>
        <path d="M15 4.8l4.2 4.2-2.8 1-3.7 3.7v2.6L10 13.6l-3.7 1 3.2-3.2-1-2.8L15 4.8z" />
        <path d="M12 14.5L8 21" />
      </>
    ),
    menu: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M9.5 4.5v15" />
        <path d="M6.8 9.5L4.8 12l2 2.5" />
      </>
    ),
    chevronRight: <path d="M9 6l6 6-6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="sidebar-glyph"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const IconBox = ({ name }: { name: IconName }) => (
  <span className="sidebar-icon" aria-hidden="true">
    <Glyph name={name} />
  </span>
)

export default function Sidebar({
  active,
  collapsed,
  onToggle,
  pinned,
  onTogglePin,
  onChange,
  enabledWorkspaceModules,
  hasWorkspaceData,
}: Props) {
  const searchId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const pendingFocusRef = useRef(false)
  const [openDashboardGroup, setOpenDashboardGroup] = useState<WorkspaceGroupId | null>(null)
  const [openGroup, setOpenGroup] = useState<WorkspaceGroupId | null>(null)
  const [nfceOpen, setNfceOpen] = useState(false)
  const [queryRaw, setQueryRaw] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1099px)').matches,
  )
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const enabledSet = useMemo(() => new Set(enabledWorkspaceModules), [enabledWorkspaceModules])
  const query = useMemo(() => normalizeSearch(queryRaw), [queryRaw])
  const searching = query.length > 0
  const compact = collapsed && !mobile
  const showSearchField = (!compact && !mobile) || (mobile && mobileSearchOpen)

  const generalDashboard = {
    id: 'general',
    label: 'Geral',
    singular: 'Visão Geral',
    helper: 'Visão consolidada',
    icon: 'chart' as IconName,
    enabled: true,
  }

  const dashboardGroups = useMemo(
    () => WORKSPACE_GROUPS.map(group => {
      const modules = group.modules
        .map(id => WORKSPACE_MODULES.find(module => module.id === id))
        .filter((module): module is WorkspaceModuleDefinition => Boolean(module))
        .map(module => ({
          ...module,
          helper: 'Dashboard gerencial',
          icon: DASHBOARD_ICONS[module.id] ?? GROUP_ICONS[group.id],
          enabled: enabledSet.has(module.id),
        }))

      return {
        group,
        label: DASHBOARD_GROUP_META[group.id].label,
        helper: DASHBOARD_GROUP_META[group.id].helper,
        modules,
        enabledCount: modules.filter(module => module.enabled).length,
      }
    }),
    [enabledSet],
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)')
    const handleChange = () => setMobile(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (active.startsWith('dashboard:') && active !== 'dashboard:general') {
      const id = active.slice('dashboard:'.length)
      const group = WORKSPACE_GROUPS.find(item => item.modules.includes(id as never))
      if (!group) return
      setOpenDashboardGroup(group.id)
      setOpenGroup(null)
      setNfceOpen(false)
      return
    }
    if (active === 'dashboard:general') {
      setOpenDashboardGroup(null)
      setOpenGroup(null)
      setNfceOpen(false)
      return
    }
    if (active.startsWith('data:')) {
      const id = active.slice(5)
      const group = WORKSPACE_GROUPS.find(item => item.modules.includes(id as never))
      if (!group) return
      setOpenDashboardGroup(null)
      setNfceOpen(false)
      setOpenGroup(group.id)
      return
    }
    if (active.startsWith('nfce:')) {
      setOpenDashboardGroup(null)
      setOpenGroup(null)
      setNfceOpen(true)
    }
  }, [active])

  const toggleDashboardGroup = (id: WorkspaceGroupId) => {
    setOpenGroup(null)
    setNfceOpen(false)
    setOpenDashboardGroup(current => current === id ? null : id)
  }

  const toggleGroup = (id: WorkspaceGroupId) => {
    setOpenDashboardGroup(null)
    setNfceOpen(false)
    setOpenGroup(current => current === id ? null : id)
  }

  const toggleNfce = () => {
    setOpenDashboardGroup(null)
    setOpenGroup(null)
    setNfceOpen(current => !current)
  }

  const focusSearch = useCallback((select = false) => {
    const input = searchRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    if (select) input.select()
  }, [])

  const activateSearch = useCallback(() => {
    if (mobile) {
      setMobileSearchOpen(true)
      pendingFocusRef.current = true
      return
    }
    if (collapsed) {
      pendingFocusRef.current = true
      onToggle()
      return
    }
    focusSearch(true)
  }, [collapsed, focusSearch, mobile, onToggle])

  useEffect(() => {
    if (!showSearchField || !pendingFocusRef.current) return
    pendingFocusRef.current = false
    const frame = window.requestAnimationFrame(() => focusSearch(true))
    return () => window.cancelAnimationFrame(frame)
  }, [focusSearch, showSearchField])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      activateSearch()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activateSearch])

  const filesSectionMatched = matchesQuery(query, 'ARQUIVOS E DADOS', 'arquivos', 'dados')
  const dashboardsSectionMatched = matchesQuery(query, 'DASHBOARDS', 'dashboard')
  const validationSectionMatched = matchesQuery(query, 'VALIDAÇÃO', 'validacao', 'validação')

  const generalDashboardVisible = !searching || dashboardsSectionMatched ||
    matchesQuery(query, generalDashboard.label, generalDashboard.singular, generalDashboard.helper, 'DASHBOARDS', 'geral')

  const visibleDashboardGroups = useMemo(() => {
    return dashboardGroups.map(item => {
      const groupMatched = matchesQuery(
        query,
        item.label,
        item.helper,
        item.group.id,
        'DASHBOARDS',
      )
      const matchedModules = item.modules.filter(module =>
        matchesQuery(query, module.label, module.singular, module.helper, module.id, item.label),
      )
      const visibleModules = !searching || dashboardsSectionMatched || groupMatched
        ? item.modules
        : matchedModules
      const visible = !searching || dashboardsSectionMatched || groupMatched || matchedModules.length > 0
      return { ...item, visibleModules, visible, groupMatched }
    })
  }, [dashboardGroups, dashboardsSectionMatched, query, searching])

  const visibleFixedFiles = useMemo(() => {
    if (!searching || filesSectionMatched) return FIXED_FILES
    return FIXED_FILES.filter(item =>
      matchesQuery(query, item.label, item.helper, item.id, 'ARQUIVOS E DADOS', item.id === 'internal-products' ? 'lista produtos internos codigo descricao' : 'importacao importação'),
    )
  }, [filesSectionMatched, query, searching])

  const visibleGroups = useMemo(() => {
    return WORKSPACE_GROUPS.map(group => {
      const modules = group.modules
        .map(id => WORKSPACE_MODULES.find(module => module.id === id))
        .filter((module): module is WorkspaceModuleDefinition => Boolean(module))
      const groupMatched = matchesQuery(query, group.label, group.id, 'ARQUIVOS E DADOS')
      const matchedModules = modules.filter(module =>
        matchesQuery(query, module.label, module.singular, module.id, group.label),
      )
      const visibleModules = !searching || filesSectionMatched || groupMatched ? modules : matchedModules
      const visible = !searching || filesSectionMatched || groupMatched || matchedModules.length > 0
      const enabledCount = modules.filter(module => enabledSet.has(module.id)).length
      return { group, modules, visibleModules, visible, enabledCount, groupMatched }
    })
  }, [enabledSet, filesSectionMatched, query, searching])

  const visibleValidation = useMemo(() => {
    if (!searching || validationSectionMatched) return VALIDATION_ITEMS
    return VALIDATION_ITEMS.filter(item =>
      matchesQuery(query, item.label, item.helper, item.id, 'VALIDAÇÃO', 'validacao'),
    )
  }, [query, searching, validationSectionMatched])

  const nfceMatched = useMemo(() => {
    if (!searching || validationSectionMatched) return true
    if (matchesQuery(query, NFCE_MENU.label, NFCE_MENU.helper, 'nfce', 'xml', 'danfe')) return true
    return NFCE_CHILDREN.some(item => matchesQuery(query, item.label, item.id, 'nfce'))
  }, [query, searching, validationSectionMatched])

  const showDashboards = generalDashboardVisible || visibleDashboardGroups.some(item => item.visible)
  const showFiles = visibleFixedFiles.length > 0 || visibleGroups.some(item => item.visible)
  const showValidation = visibleValidation.length > 0 || nfceMatched
  const hasResults = showDashboards || showFiles || showValidation

  const navEntries = useMemo(() => {
    const entries: NavEntry[] = []
    if (generalDashboardVisible) {
      entries.push({
        key: 'dashboard:general',
        kind: 'item',
        target: 'dashboard:general',
        enabled: true,
        scope: 'dashboard',
      })
    }
    visibleDashboardGroups.forEach(item => {
      if (!item.visible) return
      entries.push({
        key: `dashboard-group:${item.group.id}`,
        kind: 'group',
        target: item.group.id,
        enabled: true,
        groupId: item.group.id,
        scope: 'dashboard',
      })
      if (openDashboardGroup !== item.group.id) return
      item.visibleModules.forEach(module => {
        entries.push({
          key: `dashboard:${module.id}`,
          kind: 'item',
          target: `dashboard:${module.id}`,
          enabled: module.enabled,
          groupId: item.group.id,
          scope: 'dashboard',
        })
      })
    })
    visibleFixedFiles.forEach(item => {
      entries.push({ key: item.id, kind: 'item', target: item.id, enabled: true })
    })
    visibleGroups.forEach(item => {
      if (!item.visible) return
      const isOpen = openGroup === item.group.id
      entries.push({
        key: `group:${item.group.id}`,
        kind: 'group',
        target: item.group.id,
        enabled: true,
        groupId: item.group.id,
      })
      if (!isOpen) return
      item.visibleModules.forEach(module => {
        entries.push({
          key: `data:${module.id}`,
          kind: 'item',
          target: `data:${module.id}`,
          enabled: enabledSet.has(module.id),
          groupId: item.group.id,
        })
      })
    })
    visibleValidation.forEach(item => {
      entries.push({ key: item.id, kind: 'item', target: item.id, enabled: true })
    })
    if (nfceMatched) {
      entries.push({ key: 'group:nfce', kind: 'group', target: 'nfce', enabled: true, groupId: 'nfce' })
      if (nfceOpen) {
        NFCE_CHILDREN.forEach(item => {
          entries.push({ key: item.id, kind: 'item', target: item.id, enabled: true, groupId: 'nfce' })
        })
      }
    }
    return entries
  }, [enabledSet, generalDashboardVisible, nfceMatched, nfceOpen, openDashboardGroup, openGroup, visibleDashboardGroups, visibleFixedFiles, visibleGroups, visibleValidation])

  useEffect(() => {
    setSelectedKey(current => current && navEntries.some(entry => entry.key === current) ? current : null)
  }, [navEntries])

  const scrollEntryIntoView = (key: string) => {
    const nav = navRef.current
    const element = document.getElementById(`sidebar-nav-${key}`)
    if (!nav || !element) return
    const navRect = nav.getBoundingClientRect()
    const elRect = element.getBoundingClientRect()
    if (elRect.bottom > navRect.bottom) nav.scrollTop += elRect.bottom - navRect.bottom + 8
    if (elRect.top < navRect.top) nav.scrollTop -= navRect.top - elRect.top + 8
  }

  const activateEntry = (entry: NavEntry) => {
    if (entry.kind === 'group' && entry.groupId) {
      if (entry.scope === 'dashboard' && entry.groupId !== 'nfce') {
        if (collapsed) {
          onToggle()
          setOpenGroup(null)
          setNfceOpen(false)
          setOpenDashboardGroup(entry.groupId)
          return
        }
        toggleDashboardGroup(entry.groupId)
        return
      }
      if (entry.groupId === 'nfce') {
        if (collapsed) {
          onToggle()
          setOpenGroup(null)
          setNfceOpen(true)
          return
        }
        toggleNfce()
        return
      }
      if (collapsed) {
        onToggle()
        setNfceOpen(false)
        setOpenGroup(entry.groupId)
        return
      }
      toggleGroup(entry.groupId)
      return
    }
    if (!entry.enabled) return
    if (!entry.groupId) {
      if (entry.scope !== 'dashboard') setOpenDashboardGroup(null)
      setOpenGroup(null)
      setNfceOpen(false)
    }
    onChange(entry.target)
    if (mobile) setMobileSearchOpen(false)
  }

  const moveSelection = (direction: 1 | -1) => {
    if (navEntries.length === 0) return
    const currentIndex = selectedKey ? navEntries.findIndex(entry => entry.key === selectedKey) : -1
    let nextIndex = currentIndex
    for (let step = 0; step < navEntries.length; step += 1) {
      nextIndex = (nextIndex + direction + navEntries.length) % navEntries.length
      const candidate = navEntries[nextIndex]
      if (candidate.kind === 'group' || candidate.enabled) {
        setSelectedKey(candidate.key)
        scrollEntryIntoView(candidate.key)
        return
      }
    }
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (queryRaw) {
        setQueryRaw('')
        setSelectedKey(null)
        return
      }
      searchRef.current?.blur()
      if (mobile) setMobileSearchOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
      return
    }
    if (event.key === 'Enter') {
      const entry = navEntries.find(item => item.key === selectedKey) ?? navEntries.find(item => item.enabled && item.kind === 'item')
      if (!entry) return
      event.preventDefault()
      activateEntry(entry)
    }
  }

  const itemClass = (id: string, extra = '') =>
    [
      'sidebar-entry',
      active === id ? 'active' : '',
      selectedKey === id ? 'is-kbd' : '',
      extra,
    ].filter(Boolean).join(' ')

  const groupHelper = (enabledCount: number) =>
    hasWorkspaceData ? `${enabledCount} disponíveis` : 'Aguardando importação'

  const searchField = (
    <div className="sidebar-search">
      <label className="sidebar-search-field" htmlFor={searchId}>
        <span className="sidebar-search-icon" aria-hidden="true">
          <Glyph name="search" />
        </span>
        <input
          id={searchId}
          ref={searchRef}
          type="text"
          value={queryRaw}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Pesquisar menus..."
          aria-label="Pesquisar menus"
          aria-controls="sidebar-menu-results"
          aria-expanded={searching}
          aria-activedescendant={selectedKey ? `sidebar-nav-${selectedKey}` : undefined}
          onChange={event => setQueryRaw(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <kbd className="sidebar-search-kbd">Ctrl K</kbd>
      </label>
    </div>
  )

  const renderItem = (
    id: string,
    label: string,
    helper: string,
    icon: IconName,
    options?: { disabled?: boolean; title?: string; onClick?: () => void },
  ) => (
    <button
      type="button"
      key={id}
      id={`sidebar-nav-${id}`}
      className={itemClass(id, options?.disabled ? 'is-disabled' : '')}
      onClick={options?.onClick}
      disabled={options?.disabled}
      aria-current={active === id ? 'page' : undefined}
      title={options?.title ?? (compact ? label : undefined)}
    >
      <IconBox name={icon} />
      {!compact && (
        <span className="sidebar-item-copy">
          <strong>{label}</strong>
          <small>{helper}</small>
        </span>
      )}

    </button>
  )

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileSearchOpen ? 'search-open' : ''}`}>
      <div className="sidebar-container">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">P</div>
          {!collapsed && (
            <div className="sidebar-brand-copy">
              <strong>PrimeCheck</strong>
              <span>Data Validation</span>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              className={'sidebar-pin ' + (pinned ? 'active' : '')}
              onClick={onTogglePin}
              aria-pressed={pinned}
              aria-label={pinned ? 'Desafixar menu' : 'Fixar menu expandido'}
              title={pinned ? 'Desafixar menu' : 'Fixar menu expandido'}
            >
              <Glyph name="pin" />
            </button>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Glyph name="menu" />
          </button>
        </div>

        {showSearchField && searchField}

        {compact && (
          <button
            type="button"
            className="sidebar-search-compact"
            onClick={activateSearch}
            aria-label="Pesquisar menus"
            title="Pesquisar menus (Ctrl K)"
          >
            <IconBox name="search" />
          </button>
        )}

        <nav
          ref={navRef}
          id="sidebar-menu-results"
          className="sidebar-nav"
          aria-label="Navegação principal"
        >
          {mobile && (
            <button
              type="button"
              className="sidebar-search-compact sidebar-search-compact-mobile"
              onClick={activateSearch}
              aria-label="Pesquisar menus"
              title="Pesquisar menus (Ctrl K)"
            >
              <IconBox name="search" />
            </button>
          )}

          {showDashboards && (
            <section className="sidebar-section">
              <div className="sidebar-section-title">
                <Glyph name="chart" />
                <span>{compact ? '' : 'DASHBOARDS'}</span>
              </div>

              {generalDashboardVisible && renderItem(
                'dashboard:general',
                generalDashboard.label,
                generalDashboard.helper,
                generalDashboard.icon,
                {
                  title: compact ? 'Dashboard Geral' : undefined,
                  onClick: () => {
                    setOpenDashboardGroup(null)
                    setOpenGroup(null)
                    setNfceOpen(false)
                    onChange('dashboard:general')
                  },
                },
              )}

              {visibleDashboardGroups.map(({ group, label, helper, visibleModules, visible, enabledCount }) => {
                if (!visible) return null
                const isOpen = openDashboardGroup === group.id
                const activeInside = group.modules.some(id => active === `dashboard:${id}`)
                const groupStatus = hasWorkspaceData
                  ? `${enabledCount}/${group.modules.length} dashboards`
                  : 'Aguardando importação'

                return (
                  <div
                    className={'sidebar-group sidebar-dashboard-group ' + (isOpen ? 'open ' : '') + (activeInside ? 'active-group' : '')}
                    key={`dashboard-${group.id}`}
                  >
                    <button
                      type="button"
                      id={`sidebar-nav-dashboard-group:${group.id}`}
                      className={itemClass(`dashboard-group:${group.id}`, 'sidebar-group-toggle')}
                      onClick={() => {
                        if (collapsed) {
                          onToggle()
                          setOpenGroup(null)
                          setNfceOpen(false)
                          setOpenDashboardGroup(group.id)
                        } else {
                          toggleDashboardGroup(group.id)
                        }
                      }}
                      aria-expanded={isOpen}
                      title={compact ? `Dashboard · ${label}` : undefined}
                    >
                      <IconBox name={GROUP_ICONS[group.id]} />
                      {!compact && (
                        <span className="sidebar-item-copy">
                          <strong>{label}</strong>
                          <small>{groupStatus}</small>
                        </span>
                      )}
                      {!compact && (
                        <span className={'sidebar-item-chevron sidebar-group-chevron' + (isOpen ? ' is-open' : '')} aria-hidden="true">
                          <Glyph name={isOpen ? 'chevronDown' : 'chevronRight'} />
                        </span>
                      )}
                    </button>

                    {isOpen && (
                      <div className="sidebar-group-children">
                        {visibleModules.map(module => {
                          const childId = `dashboard:${module.id}`
                          return (
                            <button
                              type="button"
                              id={`sidebar-nav-${childId}`}
                              key={module.id}
                              className={[
                                'sidebar-child',
                                'sidebar-dashboard-child',
                                active === childId ? 'active' : '',
                                selectedKey === childId ? 'is-kbd' : '',
                                module.enabled ? '' : 'is-disabled',
                              ].filter(Boolean).join(' ')}
                              disabled={!module.enabled}
                              onClick={() => module.enabled && onChange(childId)}
                              aria-current={active === childId ? 'page' : undefined}
                              title={module.enabled
                                ? `Dashboard · ${module.label}`
                                : `Importe dados de ${module.label} para habilitar`}
                            >
                              <span className="sidebar-child-dot" />
                              <span>{module.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {!compact && isOpen && searching && helper && (
                      <span className="sidebar-dashboard-group-helper">{helper}</span>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {showFiles && (
            <section className="sidebar-section">
              <div className="sidebar-section-title">
                <Glyph name="folder" />
                <span>{compact ? '' : 'ARQUIVOS E DADOS'}</span>
              </div>

              {visibleFixedFiles.map(item =>
                renderItem(item.id, item.label, item.helper, item.icon, {
                  onClick: () => {
                    setOpenDashboardGroup(null)
                    setOpenGroup(null)
                    setNfceOpen(false)
                    onChange(item.id)
                  },
                }),
              )}

              {visibleGroups.map(({ group, visibleModules, visible, enabledCount }) => {
                if (!visible) return null
                const isOpen = openGroup === group.id
                const activeInside = visibleModules.some(module => active === `data:${module.id}`) ||
                  group.modules.some(id => active === `data:${id}`)
                const helper = groupHelper(enabledCount)

                return (
                  <div
                    className={'sidebar-group ' + (isOpen ? 'open ' : '') + (activeInside ? 'active-group' : '')}
                    key={group.id}
                  >
                    <button
                      type="button"
                      id={`sidebar-nav-group:${group.id}`}
                      className={itemClass(`group:${group.id}`, 'sidebar-group-toggle')}
                      onClick={() => {
                        if (collapsed) {
                          onToggle()
                          setOpenGroup(group.id)
                        } else {
                          toggleGroup(group.id)
                        }
                      }}
                      aria-expanded={isOpen}
                      title={compact ? group.label : undefined}
                    >
                      <IconBox name={GROUP_ICONS[group.id]} />
                      {!compact && (
                        <span className="sidebar-item-copy">
                          <strong>{group.label}</strong>
                          <small>{helper}</small>
                        </span>
                      )}
                      {!compact && (
                        <span className={'sidebar-item-chevron sidebar-group-chevron' + (isOpen ? ' is-open' : '')} aria-hidden="true">
                          <Glyph name={isOpen ? 'chevronDown' : 'chevronRight'} />
                        </span>
                      )}
                    </button>

                    {isOpen && (
                      <div className="sidebar-group-children">
                        {visibleModules.map(module => {
                          const enabled = enabledSet.has(module.id)
                          const childId = `data:${module.id}`
                          return (
                            <button
                              type="button"
                              id={`sidebar-nav-${childId}`}
                              key={module.id}
                              className={[
                                'sidebar-child',
                                active === childId ? 'active' : '',
                                selectedKey === childId ? 'is-kbd' : '',
                                enabled ? '' : 'is-disabled',
                              ].filter(Boolean).join(' ')}
                              disabled={!enabled}
                              onClick={() => {
                                if (!enabled) return
                                setOpenDashboardGroup(null)
                                onChange(childId)
                              }}
                              aria-current={active === childId ? 'page' : undefined}
                              title={!enabled ? 'Importe um arquivo com campos deste módulo para habilitar' : module.label}
                            >
                              <span className="sidebar-child-dot" />
                              <span>{module.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {showValidation && (
            <section className="sidebar-section">
              <div className="sidebar-section-title">
                <Glyph name="shield" />
                <span>{compact ? '' : 'VALIDAÇÃO'}</span>
              </div>
              {visibleValidation.map(item =>
                renderItem(item.id, item.label, item.helper, item.icon, {
                  onClick: () => {
                    setOpenDashboardGroup(null)
                    setOpenGroup(null)
                    setNfceOpen(false)
                    onChange(item.id)
                  },
                }),
              )}

              {nfceMatched && (
                <div className={'sidebar-group ' + (nfceOpen ? 'open ' : '') + (active.startsWith('nfce:') ? 'active-group' : '')}>
                  <button
                    type="button"
                    id="sidebar-nav-group:nfce"
                    className={itemClass('group:nfce', 'sidebar-group-toggle')}
                    onClick={() => {
                      if (collapsed) {
                        onToggle()
                        setOpenGroup(null)
                        setNfceOpen(true)
                      } else {
                        toggleNfce()
                      }
                    }}
                    aria-expanded={nfceOpen}
                    title={compact ? NFCE_MENU.label : undefined}
                  >
                    <IconBox name={NFCE_MENU.icon} />
                    {!compact && (
                      <span className="sidebar-item-copy">
                        <strong>{NFCE_MENU.label}</strong>
                        <small>{NFCE_MENU.helper}</small>
                      </span>
                    )}
                    {!compact && (
                      <span className={'sidebar-item-chevron sidebar-group-chevron' + (nfceOpen ? ' is-open' : '')} aria-hidden="true">
                        <Glyph name={nfceOpen ? 'chevronDown' : 'chevronRight'} />
                      </span>
                    )}
                  </button>

                  {nfceOpen && (
                    <div className="sidebar-group-children">
                      {NFCE_CHILDREN.map(item => (
                        <button
                          type="button"
                          id={`sidebar-nav-${item.id}`}
                          key={item.id}
                          className={[
                            'sidebar-child',
                            active === item.id ? 'active' : '',
                            selectedKey === item.id ? 'is-kbd' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => onChange(item.id)}
                          aria-current={active === item.id ? 'page' : undefined}
                          title={item.label}
                        >
                          <span className="sidebar-child-dot" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {searching && !hasResults && (
            <p className="sidebar-search-empty">Nenhum menu encontrado</p>
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" />
          {!collapsed && <span>Processamento local</span>}
        </div>
      </div>
    </aside>
  )
}
