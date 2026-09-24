import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import HomologationApp from './HomologationApp'
import CnpjValidatorPage from './pages/CnpjValidatorPage'
import IeValidatorPage from './pages/IeValidatorPage'
import NfceValidatorPage from './pages/NfceValidatorPage'
import NfceAnalyticsPage from './pages/NfceAnalyticsPage'
import WorkspaceImportPage from './pages/WorkspaceImportPage'
import ModuleComparisonPage from './pages/ModuleComparisonPage'
import InternalProductListPage from './pages/InternalProductListPage'
import GeneralDashboardPage from './pages/GeneralDashboardPage'
import { analyzeWorkspaceFiles, getWorkspaceModule } from './config/workspaceModules'
import type { ImportedFile } from './types'
import {
  clearWorkspaceFiles,
  clearWorkspaceSession,
  initializeWorkspaceScope,
  loadWorkspaceFiles,
  loadWorkspaceSession,
  saveWorkspaceFiles,
  saveWorkspaceNavigation,
} from './lib/workspaceStorage'

type ModuleId =
  | 'importacao'
  | 'internal-products'
  | 'homologacao'
  | 'cnpj'
  | 'ie'
  | 'nfce'
  | 'nfce:documents'
  | 'nfce:overview'
  | 'nfce:products'
  | 'nfce:consumers'
  | 'nfce:barcodes'
  | `data:${string}`
  | `dashboard:${string}`

const staticModuleTitle: Record<'importacao' | 'internal-products' | 'homologacao' | 'cnpj' | 'ie' | 'nfce', string> = {
  importacao: 'Importação e organização',
  'internal-products': 'Lista de Produtos Internos',
  homologacao: 'Homologação de conversão',
  cnpj: 'Validação de CNPJ',
  ie: 'Validação de Inscrição Estadual',
  nfce: 'Validação de NFC-e',
}

export default function App() {
  const [module, setModule] = useState<ModuleId>('dashboard:general')
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(min-width: 1100px)').matches
  })
  const [workspaceFiles, setWorkspaceFiles] = useState<ImportedFile[]>([])
  const [workspaceStorageReady, setWorkspaceStorageReady] = useState(false)
  const [workspaceStorageMessage, setWorkspaceStorageMessage] = useState('Restaurando dados locais…')
  const [visitedWorkspaceModules, setVisitedWorkspaceModules] = useState<Set<string>>(new Set())
  const [sidebarPinned, setSidebarPinned] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('primecheck.sidebar.pinned') === 'true',
  )

  useEffect(() => {
    let active = true

    void (async () => {
      const scope = await initializeWorkspaceScope()
      if (!active) return

      if (!scope) {
        setWorkspaceStorageMessage('Não foi possível identificar o IP atual. Os dados não serão restaurados entre sessões até a identificação da rede.')
        setWorkspaceStorageReady(true)
        return
      }

      const files = await loadWorkspaceFiles()
      if (!active) return

      const session = loadWorkspaceSession()
      const enabledModuleIds = new Set<string>(analyzeWorkspaceFiles(files).map(match => match.module.id))
      const restoredVisited = session.visitedModuleIds.filter(moduleId => enabledModuleIds.has(moduleId))
      const restoredModule = session.activeModule === 'nfce'
        ? 'nfce:documents'
        : session.activeModule.startsWith('nfce:')
          ? session.activeModule as ModuleId
          : 'dashboard:general'

      setWorkspaceFiles(files)
      setVisitedWorkspaceModules(new Set(restoredVisited))
      setModule(restoredModule)
      setWorkspaceStorageMessage(files.length ? 'Dados, vínculos e homologações restaurados para este IP.' : 'Nenhum dado salvo para este IP.')
      setWorkspaceStorageReady(true)
    })()

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!workspaceStorageReady) return
    void saveWorkspaceFiles(workspaceFiles)
      .then(() => setWorkspaceStorageMessage(workspaceFiles.length ? 'Dados salvos para este IP.' : 'Nenhum dado salvo para este IP.'))
      .catch(() => setWorkspaceStorageMessage('Não foi possível salvar os dados localmente.'))
  }, [workspaceFiles, workspaceStorageReady])

  useEffect(() => {
    if (!workspaceStorageReady) return
    if (!module.startsWith('nfce:') && module !== 'nfce' && module !== 'importacao' && !module.startsWith('data:') && !module.startsWith('dashboard:')) return

    saveWorkspaceNavigation(module, [...visitedWorkspaceModules])
  }, [module, visitedWorkspaceModules, workspaceStorageReady])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 1100px)')
    const handleChange = () => {
      if (media.matches) setCollapsed(false)
      else if (!sidebarPinned) setCollapsed(true)
    }
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [sidebarPinned])

  const toggleSidebar = () => {
    if (sidebarPinned) {
      setSidebarPinned(false)
      window.localStorage.setItem('primecheck.sidebar.pinned', 'false')
    }
    setCollapsed(current => !current)
  }

  const toggleSidebarPin = () => {
    setSidebarPinned(current => {
      const next = !current
      window.localStorage.setItem('primecheck.sidebar.pinned', String(next))
      if (next) setCollapsed(false)
      return next
    })
  }

  const clearImportedData = async () => {
    await clearWorkspaceFiles()
    clearWorkspaceSession()
    setWorkspaceFiles([])
    setVisitedWorkspaceModules(new Set())
    setModule('dashboard:general')
    setWorkspaceStorageMessage('Dados importados, vínculos e homologações removidos.')
  }

  const changeModule = (next: ModuleId) => {
    setModule(next)
    if (next.startsWith('data:') || (next.startsWith('dashboard:') && next !== 'dashboard:general')) {
      const moduleId = next.slice(next.indexOf(':') + 1)
      setVisitedWorkspaceModules(current => {
        if (current.has(moduleId)) return current
        const updated = new Set(current)
        updated.add(moduleId)
        return updated
      })
    }
  }

  const workspaceMatches = useMemo(
    () => analyzeWorkspaceFiles(workspaceFiles),
    [workspaceFiles],
  )

  const enabledWorkspaceModules = workspaceMatches.map(match => match.module.id)
  const activeWorkspaceModuleId = module.startsWith('data:') || module.startsWith('dashboard:')
    ? module.slice(module.indexOf(':') + 1)
    : ''
  const activeWorkspaceModule = activeWorkspaceModuleId
    ? getWorkspaceModule(activeWorkspaceModuleId)
    : undefined

  const moduleTitle = module === 'dashboard:general'
    ? 'Dashboard Geral'
    : module === 'nfce:documents' || module === 'nfce'
      ? 'Validação de NFC-e'
      : module === 'nfce:overview'
        ? 'NFC-e · Visão Geral'
        : module === 'nfce:products'
          ? 'NFC-e · Produtos mais vendidos'
          : module === 'nfce:consumers'
            ? 'NFC-e · Consumidores'
            : module === 'nfce:barcodes'
              ? 'NFC-e · Consulta de produtos'
              : module.startsWith('dashboard:')
                ? 'Dashboard · ' + (activeWorkspaceModule?.label ?? 'Dados importados')
                : module.startsWith('data:')
                  ? activeWorkspaceModule?.label ?? 'Dados importados'
                  : staticModuleTitle[module as keyof typeof staticModuleTitle]

  const openImportedModules = () => {
    const first = workspaceMatches[0]?.module.id
    if (first) changeModule(`data:${first}`)
  }

  const isHomologationModule = module === 'homologacao'
  const localBuildSha = String(import.meta.env.VITE_PRIMECHECK_SHA ?? '').slice(0, 12)

  return (
    <div className={`workspace-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        active={module}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        pinned={sidebarPinned}
        onTogglePin={toggleSidebarPin}
        onChange={next => changeModule(next as ModuleId)}
        enabledWorkspaceModules={enabledWorkspaceModules}
        hasWorkspaceData={workspaceFiles.length > 0}
      />

      <div className={`workspace-main ${isHomologationModule ? 'workspace-main-homologacao' : ''}`}>
        <div className="workspace-module-bar">
          <div>
            <span>PrimeCheck</span>
            <strong>{moduleTitle}</strong>
          </div>
          <div className="workspace-local-badge" title={localBuildSha ? `Build local ${localBuildSha}` : 'Processamento local'}>
            <i /> Processamento local{localBuildSha ? ` · ${localBuildSha}` : ''}
          </div>
        </div>

        {module === 'dashboard:general' && (
          <GeneralDashboardPage
            files={workspaceFiles}
            onNavigate={target => changeModule(target as ModuleId)}
          />
        )}

        {module === 'importacao' && (
          <WorkspaceImportPage
            files={workspaceFiles}
            onFilesChange={setWorkspaceFiles}
            onContinue={openImportedModules}
            onClear={clearImportedData}
            restoring={!workspaceStorageReady}
            storageMessage={workspaceStorageMessage}
          />
        )}

        {[...visitedWorkspaceModules].map(moduleId => {
          const workspaceModule = getWorkspaceModule(moduleId)
          if (!workspaceModule) return null
          const active = module === `data:${moduleId}` || module === `dashboard:${moduleId}`
          return (
            <div
              key={moduleId}
              className="workspace-module-cache"
              hidden={!active}
              aria-hidden={!active}
            >
              <ModuleComparisonPage
                module={workspaceModule}
                files={workspaceFiles}
                onBackToImport={() => changeModule('importacao')}
                dashboardMode={module === `dashboard:${moduleId}`}
              />
            </div>
          )
        })}

        {module === 'internal-products' && <InternalProductListPage />}
        {module === 'homologacao' && <HomologationApp />}
        {module === 'cnpj' && <CnpjValidatorPage />}
        {module === 'ie' && <IeValidatorPage />}
        {(module === 'nfce' || module === 'nfce:documents') && <NfceValidatorPage />}
        {module === 'nfce:overview' && <NfceAnalyticsPage view="overview" />}
        {module === 'nfce:products' && <NfceAnalyticsPage view="products" />}
        {module === 'nfce:consumers' && <NfceAnalyticsPage view="consumers" />}
        {module === 'nfce:barcodes' && <NfceAnalyticsPage view="barcodes" />}
      </div>
    </div>
  )
}
