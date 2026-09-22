type ModuleId = 'homologacao' | 'cnpj' | 'ie'

type Props = {
  active: ModuleId
  collapsed: boolean
  onToggle: () => void
  onChange: (module: ModuleId) => void
}

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="sidebar-icon" aria-hidden="true">{children}</span>
)

export default function Sidebar({ active, collapsed, onToggle, onChange }: Props) {
  const items: Array<{ id: ModuleId; label: string; icon: React.ReactNode; helper: string }> = [
    { id: 'homologacao', label: 'Homologação', helper: 'Conversão de dados', icon: '⇄' },
    { id: 'cnpj', label: 'Validação CNPJ', helper: 'Dígitos verificadores', icon: '✓' },
    { id: 'ie', label: 'Validação I.E.', helper: '27 UFs', icon: '▦' },
  ]

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-container">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">P</div>
          {!collapsed && (
            <div>
              <strong>PrimeCheck</strong>
              <span>Data Validation</span>
            </div>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            ☰
          </button>
        </div>

        <div className="sidebar-section-title">{!collapsed ? 'VALIDAÇÃO' : '•••'}</div>

        <nav className="sidebar-nav">
          {items.map(item => (
            <button
              type="button"
              key={item.id}
              className={active === item.id ? 'active' : ''}
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon>{item.icon}</Icon>
              {!collapsed && (
                <span className="sidebar-item-copy">
                  <strong>{item.label}</strong>
                  <small>{item.helper}</small>
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" />
          {!collapsed && <span>Processamento local</span>}
        </div>
      </div>
    </aside>
  )
}
