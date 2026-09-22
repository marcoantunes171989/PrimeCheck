import { useMemo, useRef, useState } from 'react'
import { parseFiles, formatBytes } from '../lib/files'
import { analyzeWorkspaceFiles } from '../config/workspaceModules'
import type { ImportedFile } from '../types'

const MAX_FILES = 5

export default function WorkspaceImportPage({
  files,
  onFilesChange,
  onContinue,
}: {
  files: ImportedFile[]
  onFilesChange: (files: ImportedFile[]) => void
  onContinue: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const physicalFiles = useMemo(() => {
    const map = new Map<string, ImportedFile[]>()
    files.forEach(file => {
      const list = map.get(file.name) ?? []
      list.push(file)
      map.set(file.name, list)
    })
    return [...map.entries()].map(([name, sheets]) => ({
      name,
      sheets,
      size: Math.max(...sheets.map(item => item.size), 0),
      rows: sheets.reduce((total, item) => total + item.rows.length, 0),
    }))
  }, [files])

  const matches = useMemo(() => analyzeWorkspaceFiles(files), [files])

  const modulesForFile = (name: string) =>
    matches
      .filter(match => match.fileNames.includes(name))
      .map(match => match.module.label)

  const handleFiles = async (incoming: File[]) => {
    if (!incoming.length) return

    const existingNames = new Set(physicalFiles.map(item => item.name))
    const accepted: File[] = []
    const localErrors: string[] = []

    for (const file of incoming) {
      const willBeNew = !existingNames.has(file.name)
      if (willBeNew && existingNames.size >= MAX_FILES) {
        localErrors.push(`${file.name}: limite de ${MAX_FILES} arquivos atingido.`)
        continue
      }
      accepted.push(file)
      existingNames.add(file.name)
    }

    if (!accepted.length) {
      setErrors(localErrors)
      return
    }

    setBusy(true)
    const parsed = await parseFiles(accepted)
    const replacingNames = new Set(accepted.map(file => file.name))
    const preserved = files.filter(file => !replacingNames.has(file.name))
    onFilesChange([...preserved, ...parsed.parsed])
    setErrors([...localErrors, ...parsed.errors])
    setBusy(false)
  }

  const removeFile = (name: string) => {
    onFilesChange(files.filter(file => file.name !== name))
  }

  return (
    <main className="workspace-import-page">
      <section className="workspace-import-hero">
        <div>
          <span className="eyebrow">ETAPA 1 · IMPORTAÇÃO</span>
          <h1>Importe e organize os dados da conversão.</h1>
          <p>
            Carregue até cinco arquivos de clientes, fornecedores, produtos e estruturas relacionadas.
            O PrimeCheck identifica os campos e habilita automaticamente os módulos correspondentes.
          </p>
        </div>
        <div className="workspace-import-counter">
          <strong>{physicalFiles.length}/{MAX_FILES}</strong>
          <span>arquivos</span>
        </div>
      </section>

      <section
        className={'workspace-dropzone ' + (dragging ? 'dragging' : '')}
        onDragOver={event => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          void handleFiles(Array.from(event.dataTransfer.files))
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept=".csv,.txt,.tsv,.xls,.xlsx,.xlsm,.xlsb,.ods,.fods"
          onChange={event => {
            if (event.target.files) void handleFiles(Array.from(event.target.files))
            event.currentTarget.value = ''
          }}
        />
        <div className="workspace-drop-icon">⇧</div>
        <strong>{busy ? 'Lendo e classificando arquivos…' : 'Arraste os arquivos aqui ou clique para selecionar'}</strong>
        <span>Até 5 arquivos · CSV, TXT, TSV, XLS, XLSX, XLSM, XLSB e ODS</span>
      </section>

      {errors.length > 0 && (
        <div className="workspace-import-errors">
          {errors.map(error => <span key={error}>{error}</span>)}
        </div>
      )}

      <section className="workspace-import-grid">
        {physicalFiles.map(file => {
          const modules = modulesForFile(file.name)
          return (
            <article className="workspace-file-card" key={file.name}>
              <div className="workspace-file-head">
                <div>
                  <span className="workspace-file-type">ARQUIVO IMPORTADO</span>
                  <strong>{file.name}</strong>
                  <small>{file.rows.toLocaleString('pt-BR')} registros · {formatBytes(file.size)}</small>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={event => {
                    event.stopPropagation()
                    removeFile(file.name)
                  }}
                  aria-label={'Remover ' + file.name}
                >
                  ×
                </button>
              </div>
              <div className="workspace-file-modules">
                {modules.length > 0
                  ? modules.slice(0, 6).map(label => <span key={label}>{label}</span>)
                  : <span className="workspace-module-unidentified">Tipo ainda não identificado</span>
                }
                {modules.length > 6 && <span>+{modules.length - 6}</span>}
              </div>
            </article>
          )
        })}

        {physicalFiles.length === 0 && (
          <div className="workspace-import-empty">
            <strong>Nenhum arquivo importado.</strong>
            <span>Você pode importar vários arquivos de uma vez e o PrimeCheck separará as informações por módulo.</span>
          </div>
        )}
      </section>

      <section className="workspace-module-preview">
        <div>
          <span className="eyebrow">MÓDULOS IDENTIFICADOS</span>
          <h2>{matches.length} {matches.length === 1 ? 'módulo disponível' : 'módulos disponíveis'}</h2>
          <p>Os menus serão habilitados somente quando os campos correspondentes forem encontrados nos arquivos.</p>
        </div>
        <div className="workspace-module-chips">
          {matches.map(match => (
            <span key={match.module.id}>
              {match.module.label}
              <small>{match.rowCount.toLocaleString('pt-BR')}</small>
            </span>
          ))}
          {!matches.length && <em>Importe arquivos para identificar os módulos.</em>}
        </div>
      </section>

      <div className="workspace-import-action">
        <div>
          <strong>{matches.length ? 'Dados prontos para organização.' : 'Aguardando arquivos reconhecidos.'}</strong>
          <span>Os dados permanecem somente na memória desta aba.</span>
        </div>
        <button
          type="button"
          className="button primary large"
          disabled={!files.length || !matches.length || busy}
          onClick={onContinue}
        >
          Organizar dados e abrir módulos
        </button>
      </div>
    </main>
  )
}
