import { useEffect, useMemo, useState } from 'react'
import HomologationApp from '../HomologationApp'
import clientDestinationSql from '../sql/cliente-destino-intersolid.sql?raw'
import supplierDestinationSql from '../sql/fornecedor-destino-intersolid.sql?raw'
import groupDestinationSql from '../sql/grupo-destino-intersolid.sql?raw'
import subgroupDestinationSql from '../sql/subgrupo-destino-intersolid.sql?raw'
import {
  getWorkspaceComparisonFileRole,
  getWorkspaceEntityProfile,
  resolveModuleHeaders,
  type WorkspaceModuleDefinition,
} from '../config/workspaceModules'
import type { ImportedFile } from '../types'
import {
  hasWorkspaceExecution,
  loadWorkspaceComparisonSelection,
  loadWorkspaceMapping,
  saveWorkspaceComparisonSelection,
  saveWorkspaceExecution,
  saveWorkspaceMapping,
} from '../lib/workspaceStorage'

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

type ClientFileRole = 'origin' | 'target' | null
type SupplierFileRole = 'origin' | 'target' | null

const clientFileRole = (fileName: string): ClientFileRole => {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const normalized = normalizeName(stem)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized.startsWith('cliente_')) return null

  const suffix = normalized.slice('cliente_'.length).replace(/_/g, '')
  if (!suffix) return null
  return suffix === 'intersolid' ? 'target' : 'origin'
}

const clientFantasyName = (fileName: string) => {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const match = stem.match(/^cliente_(.+)$/i)
  if (!match) return ''
  return match[1]
}

const supplierFileRole = (fileName: string): SupplierFileRole => {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const normalized = normalizeName(stem)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized.startsWith('fornecedor_')) return null

  const suffix = normalized.slice('fornecedor_'.length).replace(/_/g, '')
  if (!suffix) return null
  return suffix === 'intersolid' ? 'target' : 'origin'
}

const pickInitialPair = (names: string[], moduleId: WorkspaceModuleDefinition['id']) => {
  if (moduleId === 'clients') {
    return {
      origin: names.find(name => clientFileRole(name) === 'origin') ?? '',
      target: names.find(name => clientFileRole(name) === 'target') ?? '',
    }
  }

  if (moduleId === 'suppliers') {
    return {
      origin: names.find(name => supplierFileRole(name) === 'origin') ?? '',
      target: names.find(name => supplierFileRole(name) === 'target') ?? '',
    }
  }

  if (moduleId === 'sections' || moduleId === 'groups' || moduleId === 'subgroups') {
    return {
      origin: names.find(name => getWorkspaceComparisonFileRole(moduleId, name) === 'origin') ?? '',
      target: names.find(name => getWorkspaceComparisonFileRole(moduleId, name) === 'target') ?? '',
    }
  }

  if (names.length < 2) return { origin: names[0] ?? '', target: '' }

  const originPattern = /(donaire|origem|legado|source|antigo|anterior)/
  const targetPattern = /(intersolid|inter\s*solid|destino|target|convert|novo|homolog)/
  const origin = names.find(name => originPattern.test(normalizeName(name))) ?? names[0]
  const target = names.find(name => name !== origin && targetPattern.test(normalizeName(name)))
    ?? names.find(name => name !== origin)
    ?? ''

  return { origin, target }
}

export default function ModuleComparisonPage({
  module,
  files,
  onBackToImport,
  dashboardMode = false,
}: {
  module: WorkspaceModuleDefinition
  files: ImportedFile[]
  onBackToImport: () => void
  dashboardMode?: boolean
}) {
  const resolved = useMemo(() => resolveModuleHeaders(files, module), [files, module])
  const physicalNames = useMemo(
    () => [...new Set(resolved.files.map(file => file.name))],
    [resolved.files],
  )

  const [originName, setOriginName] = useState('')
  const [targetName, setTargetName] = useState('')
  const [clientSqlOpen, setClientSqlOpen] = useState(false)
  const [clientSqlCopied, setClientSqlCopied] = useState(false)
  const [supplierSqlOpen, setSupplierSqlOpen] = useState(false)
  const [supplierSqlCopied, setSupplierSqlCopied] = useState(false)
  const [groupSqlOpen, setGroupSqlOpen] = useState(false)
  const [groupSqlCopied, setGroupSqlCopied] = useState(false)
  const [subgroupSqlOpen, setSubgroupSqlOpen] = useState(false)
  const [subgroupSqlCopied, setSubgroupSqlCopied] = useState(false)

  const originOptions = useMemo(
    () => module.id === 'clients'
      ? physicalNames.filter(name => clientFileRole(name) === 'origin')
      : module.id === 'suppliers'
        ? physicalNames.filter(name => supplierFileRole(name) === 'origin')
        : module.id === 'sections' || module.id === 'groups' || module.id === 'subgroups'
          ? physicalNames.filter(name => getWorkspaceComparisonFileRole(module.id, name) === 'origin')
          : physicalNames,
    [module.id, physicalNames],
  )
  const targetOptions = useMemo(
    () => module.id === 'clients'
      ? physicalNames.filter(name => clientFileRole(name) === 'target')
      : module.id === 'suppliers'
        ? physicalNames.filter(name => supplierFileRole(name) === 'target')
        : module.id === 'sections' || module.id === 'groups' || module.id === 'subgroups'
          ? physicalNames.filter(name => getWorkspaceComparisonFileRole(module.id, name) === 'target')
          : physicalNames,
    [module.id, physicalNames],
  )
  const clientPairReady = module.id !== 'clients' || (originOptions.length > 0 && targetOptions.length > 0)
  const supplierPairReady = module.id !== 'suppliers' || (originOptions.length > 0 && targetOptions.length > 0)
  const sectionPairReady = module.id !== 'sections' || (originOptions.length > 0 && targetOptions.length > 0)
  const groupPairReady = module.id !== 'groups' || (originOptions.length > 0 && targetOptions.length > 0)
  const subgroupPairReady = module.id !== 'subgroups' || (originOptions.length > 0 && targetOptions.length > 0)
  const pairReady = clientPairReady && supplierPairReady && sectionPairReady && groupPairReady && subgroupPairReady

  useEffect(() => {
    const stored = loadWorkspaceComparisonSelection(module.id)
    const storedIsValid = Boolean(
      stored
      && physicalNames.includes(stored.originName)
      && physicalNames.includes(stored.targetName)
      && stored.originName !== stored.targetName
      && (
        module.id !== 'clients'
        || (
          clientFileRole(stored.originName) === 'origin'
          && clientFileRole(stored.targetName) === 'target'
        )
      )
      && (
        module.id !== 'suppliers'
        || (
          supplierFileRole(stored.originName) === 'origin'
          && supplierFileRole(stored.targetName) === 'target'
        )
      )
      && (
        module.id !== 'sections'
        || (
          getWorkspaceComparisonFileRole('sections', stored.originName) === 'origin'
          && getWorkspaceComparisonFileRole('sections', stored.targetName) === 'target'
        )
      )
      && (
        module.id !== 'groups'
        || (
          getWorkspaceComparisonFileRole('groups', stored.originName) === 'origin'
          && getWorkspaceComparisonFileRole('groups', stored.targetName) === 'target'
        )
      )
      && (
        module.id !== 'subgroups'
        || (
          getWorkspaceComparisonFileRole('subgroups', stored.originName) === 'origin'
          && getWorkspaceComparisonFileRole('subgroups', stored.targetName) === 'target'
        )
      ),
    )
    const pair = storedIsValid && stored
      ? { origin: stored.originName, target: stored.targetName }
      : pickInitialPair(physicalNames, module.id)
    setOriginName(pair.origin)
    setTargetName(pair.target)
  }, [module.id, physicalNames.join('|')])

  useEffect(() => {
    if (!originName || !targetName || originName === targetName) return
    saveWorkspaceComparisonSelection(module.id, originName, targetName)
  }, [module.id, originName, targetName])

  const originFiles = useMemo(
    () => resolved.files.filter(file => file.name === originName),
    [resolved.files, originName],
  )
  const targetFiles = useMemo(
    () => resolved.files.filter(file => file.name === targetName),
    [resolved.files, targetName],
  )
  const profile = useMemo(() => getWorkspaceEntityProfile(module.id), [module.id])
  const storageModuleId = module.id === 'clients'
    ? 'clients:checklist-v14'
    : module.id === 'suppliers'
      ? 'suppliers:checklist-v2'
      : module.id === 'sections'
        ? 'sections:checklist-v1'
        : module.id === 'groups'
          ? 'groups:checklist-v1'
          : module.id === 'subgroups'
            ? 'subgroups:checklist-v1'
            : module.id

  const originRows = originFiles.reduce((total, file) => total + file.rows.length, 0)
  const targetRows = targetFiles.reduce((total, file) => total + file.rows.length, 0)
  const canCompare = Boolean(
    originName
    && targetName
    && originName !== targetName
    && (
      module.id !== 'clients'
      || (
        clientFileRole(originName) === 'origin'
        && clientFileRole(targetName) === 'target'
      )
    )
    && (
      module.id !== 'suppliers'
      || (
        supplierFileRole(originName) === 'origin'
        && supplierFileRole(targetName) === 'target'
      )
    )
    && (
      module.id !== 'sections'
      || (
        getWorkspaceComparisonFileRole('sections', originName) === 'origin'
        && getWorkspaceComparisonFileRole('sections', targetName) === 'target'
      )
    )
    && (
      module.id !== 'groups'
      || (
        getWorkspaceComparisonFileRole('groups', originName) === 'origin'
        && getWorkspaceComparisonFileRole('groups', targetName) === 'target'
      )
    )
    && (
      module.id !== 'subgroups'
      || (
        getWorkspaceComparisonFileRole('subgroups', originName) === 'origin'
        && getWorkspaceComparisonFileRole('subgroups', targetName) === 'target'
      )
    ),
  )
  const persistedMapping = useMemo(
    () => canCompare ? loadWorkspaceMapping(storageModuleId, originName, targetName) : [],
    [canCompare, storageModuleId, originName, targetName],
  )
  const comparisonDataSignature = useMemo(() => [
    ...originFiles.map(file => `origem:${file.id}:${file.rows.length}:${file.headers.length}`),
    ...targetFiles.map(file => `destino:${file.id}:${file.rows.length}:${file.headers.length}`),
  ].join('|'), [originFiles, targetFiles])
  const restoreCompletedReport = useMemo(
    () => canCompare && hasWorkspaceExecution(
      storageModuleId,
      originName,
      targetName,
      persistedMapping,
      comparisonDataSignature,
    ),
    [canCompare, storageModuleId, originName, targetName, persistedMapping, comparisonDataSignature],
  )

  const swap = () => {
    if (module.id === 'clients' || module.id === 'suppliers' || module.id === 'sections' || module.id === 'groups' || module.id === 'subgroups') return
    setOriginName(targetName)
    setTargetName(originName)
  }

  const copyClientSql = async () => {
    try {
      await navigator.clipboard.writeText(clientDestinationSql)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = clientDestinationSql
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setClientSqlCopied(true)
    window.setTimeout(() => setClientSqlCopied(false), 1800)
  }

  const downloadClientSql = () => {
    const blob = new Blob([clientDestinationSql], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cliente-destino-intersolid.sql'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const copySupplierSql = async () => {
    try {
      await navigator.clipboard.writeText(supplierDestinationSql)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = supplierDestinationSql
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setSupplierSqlCopied(true)
    window.setTimeout(() => setSupplierSqlCopied(false), 1800)
  }

  const downloadSupplierSql = () => {
    const blob = new Blob([supplierDestinationSql], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'fornecedor-destino-intersolid.sql'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const copyGroupSql = async () => {
    try {
      await navigator.clipboard.writeText(groupDestinationSql)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = groupDestinationSql
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setGroupSqlCopied(true)
    window.setTimeout(() => setGroupSqlCopied(false), 1800)
  }

  const downloadGroupSql = () => {
    const blob = new Blob([groupDestinationSql], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'grupo-destino-intersolid.sql'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const copySubgroupSql = async () => {
    try {
      await navigator.clipboard.writeText(subgroupDestinationSql)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = subgroupDestinationSql
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setSubgroupSqlCopied(true)
    window.setTimeout(() => setSubgroupSqlCopied(false), 1800)
  }

  const downloadSubgroupSql = () => {
    const blob = new Blob([subgroupDestinationSql], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'subgrupo-destino-intersolid.sql'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!clientSqlOpen && !supplierSqlOpen && !groupSqlOpen && !subgroupSqlOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setClientSqlOpen(false)
      setSupplierSqlOpen(false)
      setGroupSqlOpen(false)
      setSubgroupSqlOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [clientSqlOpen, supplierSqlOpen, groupSqlOpen, subgroupSqlOpen])

  return (
    <main className="module-comparison-page">
      <header className="module-comparison-head">
        <div>
          <span className="eyebrow">HOMOLOGAÇÃO POR MÓDULO</span>
          <h1>{module.label}</h1>
          <p>
            Compare dois arquivos do mesmo tipo usando as mesmas regras já existentes de vínculo por campo,
            conformidade, divergências, atenções, duplicidades e não importados.
          </p>
        </div>
        <div className="module-comparison-head-actions">
          {module.id === 'clients' && (
            <button
              type="button"
              className="button secondary client-sql-open"
              onClick={() => setClientSqlOpen(true)}
            >
              Script SQL do destino
            </button>
          )}
          {module.id === 'suppliers' && (
            <button
              type="button"
              className="button secondary client-sql-open"
              onClick={() => setSupplierSqlOpen(true)}
            >
              Script SQL do destino
            </button>
          )}
          {module.id === 'groups' && (
            <button
              type="button"
              className="button secondary client-sql-open"
              onClick={() => setGroupSqlOpen(true)}
            >
              Script SQL do destino
            </button>
          )}
          {module.id === 'subgroups' && (
            <button
              type="button"
              className="button secondary client-sql-open"
              onClick={() => setSubgroupSqlOpen(true)}
            >
              Script SQL do destino
            </button>
          )}
          <button type="button" className="button ghost" onClick={onBackToImport}>
            Gerenciar arquivos
          </button>
        </div>
      </header>

      <section className="comparison-file-selector">
        <div className="comparison-file-side origin">
          <div>
            <span>ORIGEM</span>
            <strong>Arquivo de referência</strong>
          </div>
          <select
            value={originName}
            onChange={event => setOriginName(event.target.value)}
            aria-label={'Arquivo de origem para ' + module.label}
          >
            <option value="">Selecione o arquivo de origem</option>
            {originOptions.map(name => (
              <option key={'origin-' + name} value={name} disabled={name === targetName}>
                {name}
              </option>
            ))}
          </select>
          <small>
            {originName
              ? originRows.toLocaleString('pt-BR') + ' registros relacionados'
                + (module.id === 'clients'
                  ? ' · Cliente: ' + clientFantasyName(originName)
                  : module.id === 'suppliers'
                    ? ' · Fornecedor de origem'
                    : module.id === 'sections'
                      ? ' · Seções de origem'
                      : module.id === 'groups'
                        ? ' · Grupos de origem'
                        : module.id === 'subgroups'
                          ? ' · Subgrupos de origem'
                          : '')
              : module.id === 'clients'
                ? 'Padrão: CLIENTE_[nome fantasia].csv'
                : module.id === 'suppliers'
                  ? 'Padrão: FORNECEDOR_[origem].csv'
                  : module.id === 'sections'
                    ? 'Padrão: SECAO_[cliente].csv'
                    : module.id === 'groups'
                      ? 'Padrão: GRUPO_[cliente].csv'
                      : module.id === 'subgroups'
                        ? 'Padrão: SUBGRUPO_[cliente].csv'
                        : 'Aguardando seleção'}
          </small>
        </div>

        <button
          type="button"
          className="comparison-swap"
          onClick={swap}
          disabled={!originName || !targetName || module.id === 'clients' || module.id === 'suppliers' || module.id === 'sections' || module.id === 'groups' || module.id === 'subgroups'}
          title={
            module.id === 'clients'
              ? 'Em Clientes, CLIENTE_intersolid é sempre o destino'
              : module.id === 'suppliers'
                ? 'Em Fornecedores, FORNECEDOR_intersolid é sempre o destino'
              : module.id === 'sections'
                ? 'Em Seções, o arquivo Intersolid é sempre o destino'
                : module.id === 'groups'
                  ? 'Em Grupos, GRUPO_intersolid é sempre o destino'
                  : module.id === 'subgroups'
                    ? 'Em Subgrupos, SUBGRUPO_intersolid é sempre o destino'
                    : 'Trocar origem e destino'
          }
          aria-label={
            module.id === 'clients'
              ? 'Origem e destino fixos para Clientes'
              : module.id === 'suppliers'
                ? 'Origem e destino fixos para Fornecedores'
              : module.id === 'sections'
                ? 'Origem e destino fixos para Seções'
                : module.id === 'groups'
                  ? 'Origem e destino fixos para Grupos'
                  : module.id === 'subgroups'
                    ? 'Origem e destino fixos para Subgrupos'
                    : 'Trocar arquivo de origem e destino'
          }
        >
          ⇄
        </button>

        <div className="comparison-file-side target">
          <div>
            <span>DESTINO</span>
            <strong>Arquivo convertido</strong>
          </div>
          <select
            value={targetName}
            onChange={event => setTargetName(event.target.value)}
            aria-label={'Arquivo de destino para ' + module.label}
          >
            <option value="">Selecione o arquivo de destino</option>
            {targetOptions.map(name => (
              <option key={'target-' + name} value={name} disabled={name === originName}>
                {name}
              </option>
            ))}
          </select>
          <small>
            {targetName
              ? targetRows.toLocaleString('pt-BR') + ' registros relacionados'
                + (module.id === 'clients'
                  ? ' · Destino Intersolid'
                  : module.id === 'suppliers'
                    ? ' · Destino Intersolid'
                    : module.id === 'sections'
                      ? ' · Destino Intersolid'
                      : module.id === 'groups'
                        ? ' · Destino Intersolid'
                        : module.id === 'subgroups'
                          ? ' · Destino Intersolid'
                          : '')
              : module.id === 'clients'
                ? 'Padrão obrigatório: CLIENTE_intersolid.csv'
                : module.id === 'suppliers'
                  ? 'Padrão obrigatório: FORNECEDOR_intersolid.csv'
                  : module.id === 'sections'
                    ? 'Padrão obrigatório: SECAO_intersolid.csv'
                    : module.id === 'groups'
                      ? 'Padrão obrigatório: GRUPO_intersolid.csv'
                      : module.id === 'subgroups'
                        ? 'Padrão obrigatório: SUBGRUPO_intersolid.csv'
                        : 'Aguardando seleção'}
          </small>
        </div>
      </section>

      {!pairReady || physicalNames.length < 2 ? (
        <section className="comparison-pair-empty">
          <strong>É necessário importar os arquivos corretos para {module.label}.</strong>
          <span>
            {module.id === 'clients'
              ? 'Use CLIENTE_[nome fantasia].csv como origem e CLIENTE_intersolid.csv como destino. O texto após CLIENTE_ pode variar conforme o cliente.'
              : module.id === 'suppliers'
                ? 'Use FORNECEDOR_[origem].csv como origem e FORNECEDOR_intersolid.csv como destino.'
              : module.id === 'sections'
                ? 'Use SECAO_[cliente].csv como origem e SECAO_intersolid.csv como destino. Somente os campos Código/Descrição da estrutura de Seções serão considerados.'
                : module.id === 'groups'
                  ? 'Use GRUPO_[cliente].csv como origem e GRUPO_intersolid.csv como destino. A homologação considera COD_SECAO + COD_GRUPO como vínculo e valida DES_GRUPO.'
                  : module.id === 'subgroups'
                    ? 'Use SUBGRUPO_[cliente].csv como origem e SUBGRUPO_intersolid.csv como destino. A homologação considera COD_SECAO + COD_GRUPO + COD_SUB_GRUPO como vínculo e valida DES_SUB_GRUPO.'
                    : `O PrimeCheck identificou ${physicalNames.length === 1 ? 'apenas um arquivo' : 'nenhum arquivo'} para este módulo. Volte à Importação e carregue a base de origem e a base convertida/destino.`
            }
          </span>
          <button type="button" className="button primary" onClick={onBackToImport}>
            Voltar para Importação
          </button>
        </section>
      ) : !canCompare ? (
        <section className="comparison-pair-empty compact">
          <strong>Selecione arquivos diferentes para origem e destino.</strong>
          <span>
            {module.id === 'clients'
              ? 'Para Clientes, a origem deve seguir CLIENTE_[nome fantasia] e o destino deve ser CLIENTE_intersolid.'
              : module.id === 'suppliers'
                ? 'Para Fornecedores, a origem deve seguir FORNECEDOR_[origem] e o destino deve ser FORNECEDOR_intersolid.'
              : module.id === 'sections'
                ? 'Para Seções, a origem deve seguir SECAO_[cliente] e o destino deve ser SECAO_intersolid.'
                : module.id === 'groups'
                  ? 'Para Grupos, a origem deve seguir GRUPO_[cliente] e o destino deve ser GRUPO_intersolid.'
                  : module.id === 'subgroups'
                    ? 'Para Subgrupos, a origem deve seguir SUBGRUPO_[cliente] e o destino deve ser SUBGRUPO_intersolid.'
                    : 'Os nomes dos arquivos podem variar livremente; a identificação do módulo é feita pelos campos encontrados.'}
          </span>
        </section>
      ) : (
        <HomologationApp
          key={module.id + '|' + originName + '|' + targetName}
          presetOriginFiles={originFiles}
          presetTargetFiles={targetFiles}
          profileOverride={profile}
          embedded
          originLabel={originName}
          targetLabel={targetName}
          dashboardMode={dashboardMode}
          initialMapping={persistedMapping}
          onMappingChange={nextMapping =>
            saveWorkspaceMapping(storageModuleId, originName, targetName, nextMapping)
          }
          restoreCompletedReport={restoreCompletedReport}
          onComparisonExecuted={nextMapping =>
            saveWorkspaceExecution(
              storageModuleId,
              originName,
              targetName,
              nextMapping,
              comparisonDataSignature,
            )
          }
        />
      )}

      {module.id === 'clients' && clientSqlOpen && (
        <div
          className="client-sql-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setClientSqlOpen(false)
          }}
        >
          <section
            className="client-sql-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-sql-modal-title"
          >
            <header className="client-sql-modal-head">
              <div>
                <span className="eyebrow">EXPORTAÇÃO DO DESTINO</span>
                <h2 id="client-sql-modal-title">Script SQL · Clientes</h2>
                <p>
                  Execute esta consulta no banco de destino para gerar o arquivo utilizado na homologação.
                </p>
              </div>
              <button
                type="button"
                className="client-sql-modal-close"
                onClick={() => setClientSqlOpen(false)}
                aria-label="Fechar script SQL"
                title="Fechar"
              >
                ×
              </button>
            </header>

            <div className="client-sql-modal-note">
              <strong>Arquivo:</strong>
              <span>cliente-destino-intersolid.sql</span>
            </div>

            <pre className="client-sql-code"><code>{clientDestinationSql}</code></pre>

            <footer className="client-sql-modal-actions">
              <button type="button" className="button ghost" onClick={() => setClientSqlOpen(false)}>
                Fechar
              </button>
              <button type="button" className="button secondary" onClick={copyClientSql}>
                {clientSqlCopied ? 'Copiado!' : 'Copiar SQL'}
              </button>
              <button type="button" className="button primary" onClick={downloadClientSql}>
                Baixar .sql
              </button>
            </footer>
          </section>
        </div>
      )}

      {module.id === 'suppliers' && supplierSqlOpen && (
        <div
          className="client-sql-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSupplierSqlOpen(false)
          }}
        >
          <section
            className="client-sql-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-sql-modal-title"
          >
            <header className="client-sql-modal-head">
              <div>
                <span className="eyebrow">EXPORTAÇÃO DO DESTINO</span>
                <h2 id="supplier-sql-modal-title">Script SQL · Fornecedores</h2>
                <p>
                  Execute esta consulta no banco de destino para gerar o arquivo utilizado na homologação.
                </p>
              </div>
              <button
                type="button"
                className="client-sql-modal-close"
                onClick={() => setSupplierSqlOpen(false)}
                aria-label="Fechar script SQL"
                title="Fechar"
              >
                ×
              </button>
            </header>

            <div className="client-sql-modal-note">
              <strong>Arquivo:</strong>
              <span>fornecedor-destino-intersolid.sql</span>
            </div>

            <pre className="client-sql-code"><code>{supplierDestinationSql}</code></pre>

            <footer className="client-sql-modal-actions">
              <button type="button" className="button ghost" onClick={() => setSupplierSqlOpen(false)}>
                Fechar
              </button>
              <button type="button" className="button secondary" onClick={copySupplierSql}>
                {supplierSqlCopied ? 'Copiado!' : 'Copiar SQL'}
              </button>
              <button type="button" className="button primary" onClick={downloadSupplierSql}>
                Baixar .sql
              </button>
            </footer>
          </section>
        </div>
      )}

      {module.id === 'groups' && groupSqlOpen && (
        <div
          className="client-sql-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setGroupSqlOpen(false)
          }}
        >
          <section
            className="client-sql-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-sql-modal-title"
          >
            <header className="client-sql-modal-head">
              <div>
                <span className="eyebrow">EXPORTAÇÃO DO DESTINO</span>
                <h2 id="group-sql-modal-title">Script SQL · Grupos</h2>
                <p>
                  Execute esta consulta no banco de destino para gerar o arquivo utilizado na homologação.
                </p>
              </div>
              <button
                type="button"
                className="client-sql-modal-close"
                onClick={() => setGroupSqlOpen(false)}
                aria-label="Fechar script SQL"
                title="Fechar"
              >
                ×
              </button>
            </header>

            <div className="client-sql-modal-note">
              <strong>Arquivo:</strong>
              <span>grupo-destino-intersolid.sql</span>
            </div>

            <pre className="client-sql-code"><code>{groupDestinationSql}</code></pre>

            <footer className="client-sql-modal-actions">
              <button type="button" className="button ghost" onClick={() => setGroupSqlOpen(false)}>
                Fechar
              </button>
              <button type="button" className="button secondary" onClick={copyGroupSql}>
                {groupSqlCopied ? 'Copiado!' : 'Copiar SQL'}
              </button>
              <button type="button" className="button primary" onClick={downloadGroupSql}>
                Baixar .sql
              </button>
            </footer>
          </section>
        </div>
      )}

      {module.id === 'subgroups' && subgroupSqlOpen && (
        <div
          className="client-sql-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSubgroupSqlOpen(false)
          }}
        >
          <section
            className="client-sql-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subgroup-sql-modal-title"
          >
            <header className="client-sql-modal-head">
              <div>
                <span className="eyebrow">EXPORTAÇÃO DO DESTINO</span>
                <h2 id="subgroup-sql-modal-title">Script SQL · Subgrupos</h2>
                <p>
                  Execute esta consulta no banco de destino para gerar o arquivo utilizado na homologação.
                </p>
              </div>
              <button
                type="button"
                className="client-sql-modal-close"
                onClick={() => setSubgroupSqlOpen(false)}
                aria-label="Fechar script SQL"
                title="Fechar"
              >
                ×
              </button>
            </header>

            <div className="client-sql-modal-note">
              <strong>Arquivo:</strong>
              <span>subgrupo-destino-intersolid.sql</span>
            </div>

            <pre className="client-sql-code"><code>{subgroupDestinationSql}</code></pre>

            <footer className="client-sql-modal-actions">
              <button type="button" className="button ghost" onClick={() => setSubgroupSqlOpen(false)}>
                Fechar
              </button>
              <button type="button" className="button secondary" onClick={copySubgroupSql}>
                {subgroupSqlCopied ? 'Copiado!' : 'Copiar SQL'}
              </button>
              <button type="button" className="button primary" onClick={downloadSubgroupSql}>
                Baixar .sql
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}
