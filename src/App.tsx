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
  const [collapsed, setCollapsed] = useState(true)
  const [workspaceFiles, setWorkspaceFiles] = useState<ImportedFile[]>([])

  const toggleSidebar = () => {
    setCollapsed(current => {
      const next = !current
      window.localStorage.setItem('primecheck.sidebar.collapsed', String(next))
      return next
    })
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
    if (first) setModule(`data:${first}`)
  }

  const isHomologationModule = module === 'homologacao'

  return (
    <div className={`workspace-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        active={module}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onChange={next => setModule(next as ModuleId)}
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

        {activeWorkspaceModule && (
          <ModuleComparisonPage
            module={activeWorkspaceModule}
            files={workspaceFiles}
            onBackToImport={() => setModule('importacao')}
          />
        )}

        {module === 'homologacao' && <HomologationApp />}
        {module === 'cnpj' && <CnpjValidatorPage />}
        {module === 'ie' && <IeValidatorPage />}
      </div>
    </div>
  )
}
