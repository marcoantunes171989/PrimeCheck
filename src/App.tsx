import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import HomologationApp from './HomologationApp'
import CnpjValidatorPage from './pages/CnpjValidatorPage'
import IeValidatorPage from './pages/IeValidatorPage'

type ModuleId = 'homologacao' | 'cnpj' | 'ie'

const moduleTitle: Record<ModuleId, string> = {
  homologacao: 'Homologação de conversão',
  cnpj: 'Validação de CNPJ',
  ie: 'Validação de Inscrição Estadual',
}

export default function App() {
  const [module, setModule] = useState<ModuleId>('homologacao')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('primecheck.sidebar.collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(current => {
      const next = !current
      window.localStorage.setItem('primecheck.sidebar.collapsed', String(next))
      return next
    })
  }

  return (
    <div className={`workspace-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        active={module}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onChange={setModule}
      />

      <div className={`workspace-main ${module === 'homologacao' ? 'workspace-main-homologacao' : ''}`}>
        <div className="workspace-module-bar">
          <div>
            <span>PrimeCheck</span>
            <strong>{moduleTitle[module]}</strong>
          </div>
          <div className="workspace-local-badge">
            <i /> Processamento local
          </div>
        </div>

        {module === 'homologacao' && <HomologationApp />}
        {module === 'cnpj' && <CnpjValidatorPage />}
        {module === 'ie' && <IeValidatorPage />}
      </div>
    </div>
  )
}
