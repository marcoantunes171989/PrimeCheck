import { useEffect, useMemo, useState } from 'react'
import HomologationApp from '../HomologationApp'
import {
  getWorkspaceEntityProfile,
  resolveModuleHeaders,
  type WorkspaceModuleDefinition,
} from '../config/workspaceModules'
import type { ImportedFile } from '../types'

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

const pickInitialPair = (names: string[]) => {
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

  useEffect(() => {
    const pair = pickInitialPair(physicalNames)
    setOriginName(pair.origin)
    setTargetName(pair.target)
  }, [module.id, physicalNames.join('|')])

  const originFiles = useMemo(
    () => resolved.files.filter(file => file.name === originName),
    [resolved.files, originName],
  )
  const targetFiles = useMemo(
    () => resolved.files.filter(file => file.name === targetName),
    [resolved.files, targetName],
  )
  const profile = useMemo(() => getWorkspaceEntityProfile(module.id), [module.id])

  const originRows = originFiles.reduce((total, file) => total + file.rows.length, 0)
  const targetRows = targetFiles.reduce((total, file) => total + file.rows.length, 0)
  const canCompare = Boolean(originName && targetName && originName !== targetName)

  const swap = () => {
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
            {physicalNames.map(name => (
              <option key={'origin-' + name} value={name} disabled={name === targetName}>
                {name}
              </option>
            ))}
          </select>
          <small>{originName ? originRows.toLocaleString('pt-BR') + ' registros relacionados' : 'Aguardando seleção'}</small>
        </div>

        <button
          type="button"
          className="comparison-swap"
          onClick={swap}
          disabled={!originName || !targetName}
          title="Trocar origem e destino"
          aria-label="Trocar arquivo de origem e destino"
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
            {physicalNames.map(name => (
              <option key={'target-' + name} value={name} disabled={name === originName}>
                {name}
              </option>
            ))}
          </select>
          <small>{targetName ? targetRows.toLocaleString('pt-BR') + ' registros relacionados' : 'Aguardando seleção'}</small>
        </div>
      </section>

      {physicalNames.length < 2 ? (
        <section className="comparison-pair-empty">
          <strong>É necessário importar dois arquivos compatíveis com {module.label}.</strong>
          <span>
            O PrimeCheck identificou {physicalNames.length === 1 ? 'apenas um arquivo' : 'nenhum arquivo'} para este módulo.
            Volte à Importação e carregue, por exemplo, a base de origem e a base convertida/destino.
          </span>
          <button type="button" className="button primary" onClick={onBackToImport}>
            Voltar para Importação
          </button>
        </section>
      ) : !canCompare ? (
        <section className="comparison-pair-empty compact">
          <strong>Selecione arquivos diferentes para origem e destino.</strong>
          <span>Os nomes dos arquivos podem variar livremente; a identificação do módulo é feita pelos campos encontrados.</span>
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
        />
      )}
    </main>
  )
}
