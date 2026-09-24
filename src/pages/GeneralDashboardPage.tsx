import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  analyzeWorkspaceFiles,
  WORKSPACE_GROUPS,
  WORKSPACE_MODULES,
  type WorkspaceGroupId,
} from '../config/workspaceModules'
import { loadInternalProductList, type InternalProductSnapshot } from '../lib/internalProductStorage'
import { initializeWorkspaceScope, loadNfceDocuments } from '../lib/workspaceStorage'
import { formatNfceMoney, type NfceSummary } from '../lib/nfce'
import type { ImportedFile } from '../types'
import '../generalDashboard.css'

const GROUP_META: Record<WorkspaceGroupId, { label: string; short: string }> = {
  partners: { label: 'Parceiros', short: 'Clientes, fornecedores e transportadoras' },
  structure: { label: 'Classificação Mercadológica', short: 'Seções, grupos e subgrupos' },
  products: { label: 'Produto por Loja', short: 'Produtos, lojas, barras e vínculos' },
  fiscal: { label: 'Fiscal e Conteúdo', short: 'NCM, CEST e informações fiscais' },
}

const formatNumber = (value: number) => value.toLocaleString('pt-BR')

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

const statusLabel = (count: number) => count > 0 ? 'Dados disponíveis' : 'Aguardando importação'

export default function GeneralDashboardPage({
  files,
  onNavigate,
}: {
  files: ImportedFile[]
  onNavigate: (target: string) => void
}) {
  const [internalProducts, setInternalProducts] = useState<InternalProductSnapshot | null>(null)
  const [nfceDocuments, setNfceDocuments] = useState<NfceSummary[]>([])
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())

  const refreshExtras = useCallback(async () => {
    setLoadingExtras(true)
    try {
      await initializeWorkspaceScope()
      const [products, nfces] = await Promise.all([
        loadInternalProductList().catch(() => null),
        loadNfceDocuments().catch(() => []),
      ])
      setInternalProducts(products)
      setNfceDocuments(nfces)
      setUpdatedAt(new Date())
    } finally {
      setLoadingExtras(false)
    }
  }, [])

  useEffect(() => {
    void refreshExtras()
  }, [refreshExtras])

  const matches = useMemo(() => analyzeWorkspaceFiles(files), [files])
  const totalImportedRows = useMemo(
    () => files.reduce((total, file) => total + file.rows.length, 0),
    [files],
  )
  const totalImportedBytes = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  )

  const matchById = useMemo(
    () => new Map(matches.map(match => [match.module.id, match])),
    [matches],
  )

  const groupStats = useMemo(() => WORKSPACE_GROUPS.map(group => {
    const groupMatches = matches.filter(match => match.module.group === group.id)
    const rows = groupMatches.reduce((total, match) => total + match.rowCount, 0)
    return {
      id: group.id,
      label: GROUP_META[group.id].label,
      helper: GROUP_META[group.id].short,
      modulesAvailable: groupMatches.length,
      modulesTotal: group.modules.length,
      rows,
    }
  }), [matches])

  const maxGroupRows = Math.max(1, ...groupStats.map(item => item.rows))

  const rankedModules = useMemo(
    () => [...matches]
      .sort((a, b) => b.rowCount - a.rowCount)
      .slice(0, 8),
    [matches],
  )
  const maxModuleRows = Math.max(1, ...rankedModules.map(item => item.rowCount))

  const authorizedNfce = nfceDocuments.filter(item =>
    item.validXml && item.isNfce && item.statusCode === '100',
  ).length
  const nfceWarnings = Math.max(0, nfceDocuments.length - authorizedNfce)
  const nfceValue = nfceDocuments.reduce((total, item) => total + item.total, 0)

  const coveragePercent = WORKSPACE_MODULES.length
    ? Math.round((matches.length / WORKSPACE_MODULES.length) * 100)
    : 0

  const entityCards = [
    {
      label: 'Clientes',
      value: matchById.get('clients')?.rowCount ?? 0,
      helper: 'registros relacionados',
      target: 'dashboard:clients',
      enabled: matchById.has('clients'),
    },
    {
      label: 'Fornecedores',
      value: matchById.get('suppliers')?.rowCount ?? 0,
      helper: 'registros relacionados',
      target: 'dashboard:suppliers',
      enabled: matchById.has('suppliers'),
    },
    {
      label: 'Transportadoras',
      value: matchById.get('carriers')?.rowCount ?? 0,
      helper: 'registros relacionados',
      target: 'dashboard:carriers',
      enabled: matchById.has('carriers'),
    },
    {
      label: 'Lista de Produtos',
      value: internalProducts?.rows.length ?? 0,
      helper: internalProducts ? internalProducts.fileName : 'arquivo não carregado',
      target: 'internal-products',
      enabled: Boolean(internalProducts),
    },
    {
      label: 'Produtos',
      value: matchById.get('products')?.rowCount ?? 0,
      helper: 'cadastro principal detectado',
      target: 'dashboard:products',
      enabled: matchById.has('products'),
    },
    {
      label: 'XML NFC-e',
      value: nfceDocuments.length,
      helper: nfceDocuments.length ? `${authorizedNfce} autorizadas` : 'nenhum XML carregado',
      target: 'nfce:overview',
      enabled: nfceDocuments.length > 0,
    },
  ]

  const navigationGroups = useMemo(() => WORKSPACE_GROUPS.map(group => {
    const modules = group.modules
      .map(moduleId => WORKSPACE_MODULES.find(module => module.id === moduleId))
      .filter((module): module is NonNullable<typeof module> => Boolean(module))
      .map(module => {
        const match = matchById.get(module.id)
        return {
          id: module.id,
          label: module.label,
          description: module.description,
          rowCount: match?.rowCount ?? 0,
          files: match?.fileNames.length ?? 0,
          enabled: Boolean(match),
        }
      })

    return {
      id: group.id,
      label: GROUP_META[group.id].label,
      helper: GROUP_META[group.id].short,
      rows: modules.reduce((total, module) => total + module.rowCount, 0),
      available: modules.filter(module => module.enabled).length,
      total: modules.length,
      modules,
    }
  }), [matchById])

  const filesWithModules = useMemo(() => files.map(file => ({
    file,
    modules: matches
      .filter(match => match.fileIds.includes(file.id))
      .map(match => match.module.label),
  })), [files, matches])

  return (
    <main className="general-dashboard-page" data-dashboard="general">
      <header className="general-dashboard-hero">
        <div>
          <span className="eyebrow">VISÃO GERAL · DADOS PROCESSADOS</span>
          <h1>Dashboard Geral</h1>
          <p>
            Acompanhe em uma única visão os dados importados, módulos identificados, lista interna de produtos
            e XMLs NFC-e disponíveis no PrimeCheck.
          </p>
        </div>
        <div className="general-dashboard-actions">
          <span>
            Atualizado {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button type="button" className="dashboard-navigation-button" onClick={() => onNavigate('importacao')}>
            Importação
          </button>
          <button type="button" onClick={() => void refreshExtras()} disabled={loadingExtras}>
            {loadingExtras ? 'Atualizando…' : 'Atualizar dados'}
          </button>
        </div>
      </header>

      <section className="general-dashboard-kpis" aria-label="Indicadores gerais">
        <article>
          <span>Arquivos importados</span>
          <strong>{formatNumber(files.length)}</strong>
          <small>{formatBytes(totalImportedBytes)} processados</small>
        </article>
        <article>
          <span>Registros carregados</span>
          <strong>{formatNumber(totalImportedRows)}</strong>
          <small>linhas nos arquivos de dados</small>
        </article>
        <article>
          <span>Módulos identificados</span>
          <strong>{formatNumber(matches.length)}</strong>
          <small>de {WORKSPACE_MODULES.length} módulos disponíveis</small>
        </article>
        <article>
          <span>Produtos internos</span>
          <strong>{formatNumber(internalProducts?.rows.length ?? 0)}</strong>
          <small>{internalProducts ? 'lista disponível' : 'aguardando lista'}</small>
        </article>
        <article>
          <span>XMLs NFC-e</span>
          <strong>{formatNumber(nfceDocuments.length)}</strong>
          <small>{authorizedNfce} autorizadas · {nfceWarnings} atenções</small>
        </article>
      </section>

      <section className="general-dashboard-grid general-dashboard-grid-main">
        <article className="general-dashboard-card coverage-card">
          <div className="general-dashboard-card-head">
            <div>
              <span className="eyebrow">COBERTURA</span>
              <h2>Ecossistema de dados</h2>
            </div>
            <small>{matches.length}/{WORKSPACE_MODULES.length} módulos</small>
          </div>
          <div className="coverage-content">
            <div
              className="coverage-ring"
              style={{ '--coverage': `${coveragePercent}%` } as CSSProperties}
              aria-label={`${coveragePercent}% dos módulos identificados`}
            >
              <div>
                <strong>{coveragePercent}%</strong>
                <span>cobertura</span>
              </div>
            </div>
            <div className="coverage-groups">
              {groupStats.map(group => (
                <div key={group.id}>
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.modulesAvailable}/{group.modulesTotal} módulos</small>
                  </span>
                  <b>{formatNumber(group.rows)}</b>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="general-dashboard-card">
          <div className="general-dashboard-card-head">
            <div>
              <span className="eyebrow">DISTRIBUIÇÃO</span>
              <h2>Registros por agrupamento</h2>
            </div>
            <small>módulos detectados</small>
          </div>
          <div className="general-dashboard-bars">
            {groupStats.map(group => (
              <div className="dashboard-bar-row" key={group.id}>
                <div>
                  <strong>{group.label}</strong>
                  <small>{group.helper}</small>
                </div>
                <div className="dashboard-bar-track">
                  <span style={{ width: `${Math.max(group.rows ? 5 : 0, group.rows / maxGroupRows * 100)}%` }} />
                </div>
                <b>{formatNumber(group.rows)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="general-dashboard-entities">
        {entityCards.map(card => (
          <button
            type="button"
            key={card.label}
            className={['general-dashboard-entity-link', card.value ? 'has-data' : ''].filter(Boolean).join(' ')}
            onClick={() => card.enabled && onNavigate(card.target)}
            disabled={!card.enabled}
            title={card.enabled ? `Abrir ${card.label}` : `${card.label}: aguardando dados`}
          >
            <div className="general-entity-icon">{card.label.slice(0, 1)}</div>
            <div>
              <span>{card.label}</span>
              <strong>{formatNumber(card.value)}</strong>
              <small>{card.helper}</small>
            </div>
            <em>{statusLabel(card.value)}</em>
            <b aria-hidden="true">→</b>
          </button>
        ))}
      </section>

      <section className="general-dashboard-card general-dashboard-navigation" aria-label="Navegação rápida entre dashboards e dados">
        <div className="general-dashboard-card-head">
          <div>
            <span className="eyebrow">NAVEGAÇÃO DIRETA</span>
            <h2>Acesso rápido por área</h2>
          </div>
          <small>dashboard ou dados importados</small>
        </div>

        <div className="general-dashboard-navigation-grid">
          {navigationGroups.map(group => (
            <article key={group.id} className={group.available ? 'has-data' : ''}>
              <header>
                <div>
                  <strong>{group.label}</strong>
                  <small>{group.helper}</small>
                </div>
                <span>{group.available}/{group.total}</span>
              </header>
              <div className="general-dashboard-navigation-summary">
                <strong>{formatNumber(group.rows)}</strong>
                <small>registros relacionados</small>
              </div>
              <div className="general-dashboard-navigation-modules">
                {group.modules.map(module => (
                  <div key={module.id} className={module.enabled ? 'available' : ''}>
                    <div>
                      <strong>{module.label}</strong>
                      <small>
                        {module.enabled
                          ? `${formatNumber(module.rowCount)} registros · ${module.files} arquivo(s)`
                          : 'Aguardando importação'}
                      </small>
                    </div>
                    <div className="general-dashboard-navigation-actions">
                      <button
                        type="button"
                        disabled={!module.enabled}
                        onClick={() => module.enabled && onNavigate(`dashboard:${module.id}`)}
                      >
                        Dashboard
                      </button>
                      <button
                        type="button"
                        disabled={!module.enabled}
                        onClick={() => module.enabled && onNavigate(`data:${module.id}`)}
                      >
                        Dados
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="general-dashboard-grid">
        <article className="general-dashboard-card">
          <div className="general-dashboard-card-head">
            <div>
              <span className="eyebrow">MÓDULOS</span>
              <h2>Maiores volumes processados</h2>
            </div>
            <small>registros relacionados</small>
          </div>
          {rankedModules.length ? (
            <div className="general-dashboard-bars compact">
              {rankedModules.map(match => (
                <div className="dashboard-bar-row" key={match.module.id}>
                  <div>
                    <strong>{match.module.label}</strong>
                    <small>{match.fileNames.length} arquivo(s)</small>
                  </div>
                  <div className="dashboard-bar-track">
                    <span style={{ width: `${Math.max(5, match.rowCount / maxModuleRows * 100)}%` }} />
                  </div>
                  <b>{formatNumber(match.rowCount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="general-dashboard-empty">
              <strong>Aguardando arquivos de dados.</strong>
              <span>Os gráficos serão alimentados automaticamente conforme as importações forem realizadas.</span>
            </div>
          )}
        </article>

        <article className="general-dashboard-card nfce-summary-card">
          <div className="general-dashboard-card-head">
            <div>
              <span className="eyebrow">NFC-e</span>
              <h2>Resumo dos XMLs</h2>
            </div>
            <small>modelo 65</small>
          </div>
          <div className="nfce-summary-total">
            <span>Valor total das NFC-e</span>
            <strong>{formatNfceMoney(nfceValue)}</strong>
          </div>
          <div className="nfce-summary-stats">
            <div>
              <span>XMLs</span>
              <strong>{formatNumber(nfceDocuments.length)}</strong>
            </div>
            <div className="ok">
              <span>Autorizadas</span>
              <strong>{formatNumber(authorizedNfce)}</strong>
            </div>
            <div className={nfceWarnings ? 'warning' : ''}>
              <span>Atenções</span>
              <strong>{formatNumber(nfceWarnings)}</strong>
            </div>
          </div>
          <div className="nfce-summary-progress">
            <span>
              <i style={{ width: `${nfceDocuments.length ? authorizedNfce / nfceDocuments.length * 100 : 0}%` }} />
            </span>
            <small>
              {nfceDocuments.length
                ? `${Math.round(authorizedNfce / nfceDocuments.length * 100)}% autorizadas`
                : 'Aguardando XMLs NFC-e'}
            </small>
          </div>
        </article>
      </section>

      <section className="general-dashboard-card general-dashboard-files">
        <div className="general-dashboard-card-head">
          <div>
            <span className="eyebrow">FONTES DE DADOS</span>
            <h2>Arquivos e módulos identificados</h2>
          </div>
          <small>{files.length} arquivo(s)</small>
        </div>
        {filesWithModules.length ? (
          <div className="general-files-table-wrap">
            <table className="general-files-table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Registros</th>
                  <th>Tamanho</th>
                  <th>Módulos identificados</th>
                </tr>
              </thead>
              <tbody>
                {filesWithModules.map(({ file, modules }) => (
                  <tr key={file.id}>
                    <td><strong>{file.name}</strong><small>{file.sheetName || 'Base importada'}</small></td>
                    <td>{formatNumber(file.rows.length)}</td>
                    <td>{formatBytes(file.size)}</td>
                    <td>
                      <div className="general-module-tags">
                        {modules.length
                          ? modules.slice(0, 6).map(module => <span key={module}>{module}</span>)
                          : <em>Não classificado</em>}
                        {modules.length > 6 && <span>+{modules.length - 6}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="general-dashboard-empty">
            <strong>Nenhum arquivo importado.</strong>
            <span>Importe bases de clientes, fornecedores, produtos, estrutura ou fiscal para alimentar esta visão geral.</span>
          </div>
        )}
      </section>
    </main>
  )
}
