import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import HomologationApp from './HomologationApp'
import CnpjValidatorPage from './pages/CnpjValidatorPage'
import IeValidatorPage from './pages/IeValidatorPage'
import WorkspaceImportPage from './pages/WorkspaceImportPage'
import ModuleComparisonPage from './pages/ModuleComparisonPage'
import { analyzeWorkspaceFiles, getWorkspaceModule } from './config/workspaceModules'
import type { ImportedFile } from './types'

type ModuleId = 'importacao' | 'homologacao' | 'cnpj' | 'ie' | `data:${string}`

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
  const [visitedWorkspaceModules, setVisitedWorkspaceModules] = useState<Set<string>>(new Set())

  const toggleSidebar = () => {
    setCollapsed(current => {
      const next = !current
      window.localStorage.setItem('primecheck.sidebar.collapsed', String(next))
      return next
    })
  }

  const changeModule = (next: ModuleId) => {
    setModule(next)
    if (next.startsWith('data:')) {
      const moduleId = next.slice(5)
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
  const activeWorkspaceModuleId = module.startsWith('data:') ? module.slice(5) : ''
  const activeWorkspaceModule = activeWorkspaceModuleId
    ? getWorkspaceModule(activeWorkspaceModuleId)
    : undefined

  const moduleTitle = module.startsWith('data:')
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
          />
        )}

        {[...visitedWorkspaceModules].map(moduleId => {
          const workspaceModule = getWorkspaceModule(moduleId)
          if (!workspaceModule) return null
          const active = module === `data:${moduleId}`
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
              />
            </div>
          )
        })}

        {module === 'homologacao' && <HomologationApp />}
        {module === 'cnpj' && <CnpjValidatorPage />}
        {module === 'ie' && <IeValidatorPage />}
      </div>
    </div>
  )
}
