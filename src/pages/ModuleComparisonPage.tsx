import { useEffect, useMemo, useState } from 'react'
import HomologationApp from '../HomologationApp'
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

const pickInitialPair = (names: string[], moduleId: WorkspaceModuleDefinition['id']) => {
  if (moduleId === 'clients') {
    return {
      origin: names.find(name => clientFileRole(name) === 'origin') ?? '',
      target: names.find(name => clientFileRole(name) === 'target') ?? '',
    }
  }

  if (moduleId === 'sections') {
    return {
      origin: names.find(name => getWorkspaceComparisonFileRole('sections', name) === 'origin') ?? '',
      target: names.find(name => getWorkspaceComparisonFileRole('sections', name) === 'target') ?? '',
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

  const originOptions = useMemo(
    () => module.id === 'clients'
      ? physicalNames.filter(name => clientFileRole(name) === 'origin')
      : module.id === 'sections'
        ? physicalNames.filter(name => getWorkspaceComparisonFileRole('sections', name) === 'origin')
        : physicalNames,
    [module.id, physicalNames],
  )
  const targetOptions = useMemo(
    () => module.id === 'clients'
      ? physicalNames.filter(name => clientFileRole(name) === 'target')
      : module.id === 'sections'
        ? physicalNames.filter(name => getWorkspaceComparisonFileRole('sections', name) === 'target')
        : physicalNames,
    [module.id, physicalNames],
  )
  const clientPairReady = module.id !== 'clients' || (originOptions.length > 0 && targetOptions.length > 0)
  const sectionPairReady = module.id !== 'sections' || (originOptions.length > 0 && targetOptions.length > 0)
  const pairReady = clientPairReady && sectionPairReady

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
        module.id !== 'sections'
        || (
          getWorkspaceComparisonFileRole('sections', stored.originName) === 'origin'
          && getWorkspaceComparisonFileRole('sections', stored.targetName) === 'target'
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
  const storageModuleId = module.id === 'clients' ? 'clients:checklist-v8' : module.id

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
      module.id !== 'sections'
      || (
        getWorkspaceComparisonFileRole('sections', originName) === 'origin'
        && getWorkspaceComparisonFileRole('sections', targetName) === 'target'
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
    if (module.id === 'clients' || module.id === 'sections') return
    setOriginName(targetName)
    setTargetName(originName)
  }

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
        <button type="button" className="button ghost" onClick={onBackToImport}>
          Gerenciar arquivos
        </button>
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
                + (module.id === 'clients' ? ' · Cliente: ' + clientFantasyName(originName) : '')
              : module.id === 'clients'
                ? 'Padrão: CLIENTE_[nome fantasia].csv'
                : 'Aguardando seleção'}
          </small>
        </div>

        <button
          type="button"
          className="comparison-swap"
          onClick={swap}
          disabled={!originName || !targetName || module.id === 'clients' || module.id === 'sections'}
          title={
            module.id === 'clients'
              ? 'Em Clientes, CLIENTE_intersolid é sempre o destino'
              : module.id === 'sections'
                ? 'Em Seções, o arquivo Intersolid é sempre o destino'
                : 'Trocar origem e destino'
          }
          aria-label={
            module.id === 'clients'
              ? 'Origem e destino fixos para Clientes'
              : module.id === 'sections'
                ? 'Origem e destino fixos para Seções'
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
                + (module.id === 'clients' ? ' · Destino Intersolid' : '')
              : module.id === 'clients'
                ? 'Padrão obrigatório: CLIENTE_intersolid.csv'
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
              : module.id === 'sections'
                ? 'Use SECAO_[cliente].csv como origem e SECAO_intersolid.csv como destino. Somente os campos Código/Descrição da estrutura de Seções serão considerados.'
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
              : module.id === 'sections'
                ? 'Para Seções, a origem deve seguir SECAO_[cliente] e o destino deve ser SECAO_intersolid.'
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
    </main>
  )
}
