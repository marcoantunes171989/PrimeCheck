import { useEffect, useMemo, useState } from 'react'
import { WORKSPACE_GROUPS, WORKSPACE_MODULES, type WorkspaceGroupId } from '../config/workspaceModules'

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

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="sidebar-icon" aria-hidden="true">{children}</span>
)

const groupIcons: Record<WorkspaceGroupId, string> = {
  partners: '◎',
  structure: '⌘',
  products: '▦',
  fiscal: '◇',
}

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
  const [openGroup, setOpenGroup] = useState<WorkspaceGroupId | null>(null)

  const enabledSet = useMemo(() => new Set(enabledWorkspaceModules), [enabledWorkspaceModules])

  useEffect(() => {
    if (!active.startsWith('data:')) return
    const id = active.slice(5)
    const group = WORKSPACE_GROUPS.find(item => item.modules.includes(id as never))
    if (!group) return
    setOpenGroup(group.id)
  }, [active])

  const toggleGroup = (id: WorkspaceGroupId) => {
    setOpenGroup(current => current === id ? null : id)
  }

  const fixedItems = [
    { id: 'cnpj', label: 'Validação CNPJ', helper: 'Consulta e dígitos', icon: '✓' },
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
          {!collapsed && (
            <button
              type="button"
              className={'sidebar-pin ' + (pinned ? 'active' : '')}
              onClick={onTogglePin}
              aria-pressed={pinned}
              aria-label={pinned ? 'Desafixar menu' : 'Fixar menu expandido'}
              title={pinned ? 'Desafixar menu' : 'Fixar menu expandido'}
            >
              ⌾
            </button>
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

        <div className="sidebar-section-title">{!collapsed ? 'ARQUIVOS E DADOS' : '•••'}</div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={active === 'importacao' ? 'active' : ''}
            onClick={() => onChange('importacao')}
            title={collapsed ? 'Importação' : undefined}
          >
            <Icon>⇧</Icon>
            {!collapsed && (
              <span className="sidebar-item-copy">
                <strong>Importação</strong>
                <small>Até 5 arquivos</small>
              </span>
            )}
          </button>

          {WORKSPACE_GROUPS.map(group => {
            const modules = group.modules
              .map(id => WORKSPACE_MODULES.find(module => module.id === id))
              .filter((module): module is NonNullable<typeof module> => Boolean(module))
            const enabledCount = modules.filter(module => enabledSet.has(module.id)).length
            const isOpen = openGroup === group.id
            const activeInside = modules.some(module => active === `data:${module.id}`)

            return (
              <div
                className={'sidebar-group ' + (isOpen ? 'open ' : '') + (activeInside ? 'active-group' : '')}
                key={group.id}
              >
                <button
                  type="button"
                  className="sidebar-group-toggle"
                  onClick={() => {
                    if (collapsed) {
                      onToggle()
                      setOpenGroup(group.id)
                    } else {
                      toggleGroup(group.id)
                    }
                  }}
                  aria-expanded={isOpen}
                  title={collapsed ? group.label : undefined}
                >
                  <Icon>{groupIcons[group.id]}</Icon>
                  {!collapsed && (
                    <span className="sidebar-item-copy">
                      <strong>{group.label}</strong>
                      <small>{hasWorkspaceData ? `${enabledCount} disponíveis` : 'Aguardando importação'}</small>
                    </span>
                  )}
                  {!collapsed && <span className="sidebar-group-chevron">{isOpen ? '⌃' : '⌄'}</span>}
                </button>

                {isOpen && (
                  <div className="sidebar-group-children">
                    {modules.map(module => {
                      const enabled = enabledSet.has(module.id)
                      return (
                        <button
                          type="button"
                          key={module.id}
                          className={active === `data:${module.id}` ? 'active' : ''}
                          disabled={!enabled}
                          onClick={() => enabled && onChange(`data:${module.id}`)}
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

          <div className="sidebar-section-title sidebar-section-inline">{!collapsed ? 'DASHBOARDS' : '•••'}</div>

          {WORKSPACE_MODULES
            .filter(module => module.group === 'partners')
            .map(module => {
              const enabled = enabledSet.has(module.id)
              return (
                <button
                  type="button"
                  key={'dashboard-' + module.id}
                  className={active === `dashboard:${module.id}` ? 'active' : ''}
                  disabled={!enabled}
                  onClick={() => enabled && onChange(`dashboard:${module.id}`)}
                  title={!enabled
                    ? 'Importe arquivos compatíveis para habilitar o dashboard'
                    : collapsed
                      ? 'Dashboard · ' + module.label
                      : undefined}
                >
                  <Icon>▥</Icon>
                  {!collapsed && (
                    <span className="sidebar-item-copy">
                      <strong>{module.label}</strong>
                      <small>Dashboard gerencial</small>
                    </span>
                  )}
                </button>
              )
            })}

          <div className="sidebar-section-title sidebar-section-inline">{!collapsed ? 'VALIDAÇÃO' : '•••'}</div>

          {fixedItems.map(item => (
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
