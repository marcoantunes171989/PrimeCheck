import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import HomologationApp from './HomologationApp'
import CnpjValidatorPage from './pages/CnpjValidatorPage'
import IeValidatorPage from './pages/IeValidatorPage'
import WorkspaceImportPage from './pages/WorkspaceImportPage'
import ModuleComparisonPage from './pages/ModuleComparisonPage'
import { analyzeWorkspaceFiles, getWorkspaceModule } from './config/workspaceModules'
import type { ImportedFile } from './types'
import { clearWorkspaceFiles, loadWorkspaceFiles, saveWorkspaceFiles } from './lib/workspaceStorage'

type ModuleId = 'importacao' | 'internal-products' | 'homologacao' | 'cnpj' | 'ie' | `data:${string}` | `dashboard:${string}`

const staticModuleTitle: Record<'importacao' | 'homologacao' | 'cnpj' | 'ie', string> = {
  importacao: 'Importação e organização',
  homologacao: 'Homologação de conversão',
  cnpj: 'Validação de CNPJ',
  ie: 'Validação de Inscrição Estadual',
}

export default function App() {
  const [module, setModule] = useState<ModuleId>('importacao')
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
    void loadWorkspaceFiles().then(files => {
      if (!active) return
      setWorkspaceFiles(files)
      setWorkspaceStorageMessage(files.length ? 'Dados restaurados deste navegador.' : 'Nenhum dado salvo neste navegador.')
      setWorkspaceStorageReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!workspaceStorageReady) return
    void saveWorkspaceFiles(workspaceFiles)
      .then(() => setWorkspaceStorageMessage(workspaceFiles.length ? 'Dados salvos neste navegador.' : 'Nenhum dado salvo neste navegador.'))
      .catch(() => setWorkspaceStorageMessage('Não foi possível salvar os dados localmente.'))
  }, [workspaceFiles, workspaceStorageReady])

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
    setWorkspaceFiles([])
    setVisitedWorkspaceModules(new Set())
    setModule('importacao')
    setWorkspaceStorageMessage('Dados importados removidos deste navegador.')
  }

  const changeModule = (next: ModuleId) => {
    setModule(next)
    if (next.startsWith('data:') || next.startsWith('dashboard:')) {
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

  const moduleTitle = module.startsWith('dashboard:')
    ? 'Dashboard · ' + (activeWorkspaceModule?.label ?? 'Dados importados')
    : module.startsWith('data:')
      ? activeWorkspaceModule?.label ?? 'Dados importados'
      : staticModuleTitle[module as keyof typeof staticModuleTitle]

  const openImportedModules = () => {
    const first = workspaceMatches[0]?.module.id
    if (first) changeModule(`data:${first}`)
  }

  const isHomologationModule = module === 'homologacao'

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
          <div className="workspace-local-badge">
            <i /> Processamento local
          </div>
        </div>

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

        {module === 'internal-products' && <InternalProductListPage />}\n        {module === 'homologacao' && <HomologationApp />}
        {module === 'cnpj' && <CnpjValidatorPage />}
        {module === 'ie' && <IeValidatorPage />}
      </div>
    </div>
  )
}
