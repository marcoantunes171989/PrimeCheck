import { useEffect, useMemo, useRef, useState } from 'react'
import { parseFiles, formatBytes } from '../lib/files'
import type { ParseFilesProgress } from '../lib/files'
import { analyzeWorkspaceFiles } from '../config/workspaceModules'
import type { ImportedFile } from '../types'

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  if (minutes <= 0) return String(remainder) + 's'
  return String(minutes) + 'min ' + String(remainder).padStart(2, '0') + 's'
}

export default function WorkspaceImportPage({
  files,
  onFilesChange,
  onContinue,
  onClear,
  restoring = false,
  storageMessage = '',
}: {
  files: ImportedFile[]
  onFilesChange: (files: ImportedFile[]) => void
  onContinue: () => void
  onClear: () => void
  restoring?: boolean
  storageMessage?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [importProgress, setImportProgress] = useState<ParseFilesProgress | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const importStartedAt = useRef<number | null>(null)

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

  useEffect(() => {
    if (!busy || importStartedAt.current === null) return

    const updateElapsed = () => {
      if (importStartedAt.current === null) return
      setElapsedSeconds((Date.now() - importStartedAt.current) / 1000)
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 250)
    return () => window.clearInterval(timer)
  }, [busy])

  const remainingSeconds = useMemo(() => {
    const percent = importProgress?.overallPercent ?? 0
    if (!busy || percent <= 1 || percent >= 100 || elapsedSeconds <= 0) return null
    return Math.max(0, Math.round((elapsedSeconds * (100 - percent)) / percent))
  }, [busy, elapsedSeconds, importProgress?.overallPercent])

  const modulesForFile = (name: string) =>
    matches
      .filter(match => match.fileNames.includes(name))
      .map(match => match.module.label)

  const handleFiles = async (incoming: File[]) => {
    if (!incoming.length || busy) return

    const accepted: File[] = []
    const localErrors: string[] = []

    const xmlFiles = incoming.filter(file => /\.xml$/i.test(file.name))
    if (xmlFiles.length > 0) {
      localErrors.push(
        xmlFiles.length.toLocaleString('pt-BR')
        + ' arquivo(s) XML não foram importados nesta tela. Para NFC-e, use Validação > Validação NFC-e.',
      )
    }

    for (const file of incoming) {
      if (/\.xml$/i.test(file.name)) continue
      accepted.push(file)
    }

    if (!accepted.length) {
      setErrors(localErrors)
      return
    }

    const totalBytes = accepted.reduce((total, file) => total + Math.max(file.size, 1), 0)
    importStartedAt.current = Date.now()
    setElapsedSeconds(0)
    setBusy(true)
    setImportProgress({
      fileName: accepted[0]?.name ?? '',
      fileIndex: 0,
      totalFiles: accepted.length,
      completedFiles: 0,
      phase: 'reading',
      filePercent: 0,
      overallPercent: 0,
      loadedBytes: 0,
      totalBytes,
    })

    try {
      const parsed = await parseFiles(accepted, progress => setImportProgress(progress))
      const replacingNames = new Set(accepted.map(file => file.name))
      const preserved = files.filter(file => !replacingNames.has(file.name))
      onFilesChange([...preserved, ...parsed.parsed])
      setErrors([...localErrors, ...parsed.errors])

      const elapsed = importStartedAt.current === null
        ? elapsedSeconds
        : (Date.now() - importStartedAt.current) / 1000

      setElapsedSeconds(elapsed)
      setImportProgress(currentProgress => currentProgress
        ? {
            ...currentProgress,
            fileName: accepted[accepted.length - 1]?.name ?? currentProgress.fileName,
            fileIndex: Math.max(0, accepted.length - 1),
            completedFiles: accepted.length,
            phase: parsed.errors.length ? 'error' : 'completed',
            filePercent: 100,
            overallPercent: 100,
            loadedBytes: totalBytes,
            totalBytes,
          }
        : null)
    } finally {
      importStartedAt.current = null
      setBusy(false)
    }
  }

  const removeFile = (name: string) => {
    onFilesChange(files.filter(file => file.name !== name))
  }

  const clearImportedData = () => {
    setImportProgress(null)
    setElapsedSeconds(0)
    importStartedAt.current = null
    onClear()
  }

  return (
    <main className="workspace-import-page">
      <section className="workspace-import-hero">
        <div>
          <span className="eyebrow">ETAPA 1 · IMPORTAÇÃO</span>
          <h1>Importe e organize os dados da conversão.</h1>
          <p>
            Carregue arquivos de clientes, fornecedores, produtos e estruturas relacionadas, sem limite
            de quantidade definido pelo PrimeCheck. O sistema identifica os campos e habilita automaticamente
            os módulos correspondentes.
          </p>
        </div>
        <div className="workspace-import-hero-actions">
          <div className="workspace-storage-state">
            <i />
            <span>{storageMessage || 'Persistência local neste navegador.'}</span>
          </div>
          <div className="workspace-import-counter">
            <strong>{physicalFiles.length.toLocaleString('pt-BR')}</strong>
            <span>arquivos</span>
          </div>
        </div>
      </section>

      <section
        className={'workspace-dropzone ' + (dragging ? 'dragging' : '') + (busy ? ' busy' : '')}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          if (!busy) void handleFiles(Array.from(event.dataTransfer.files))
        }}
        onClick={() => {
          if (!busy) inputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onKeyDown={event => {
          if (!busy && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click()
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
        <strong>{busy ? 'Importação em andamento…' : 'Arraste os arquivos aqui ou clique para selecionar'}</strong>
        <span>Quantidade livre · CSV, TXT, TSV, XLS, XLSX, XLSM, XLSB e ODS</span>
      </section>

      {importProgress && (
        <section
          className={'workspace-import-progress ' + (busy ? 'is-running' : 'is-complete')}
          aria-live="polite"
        >
          <div className="workspace-import-progress-head">
            <div>
              <span className="eyebrow">{busy ? 'IMPORTAÇÃO EM ANDAMENTO' : 'ÚLTIMA IMPORTAÇÃO'}</span>
              <strong>
                {busy
                  ? (importProgress.phase === 'processing' ? 'Processando e organizando dados…' : 'Carregando arquivos…')
                  : importProgress.phase === 'error'
                    ? 'Importação concluída com avisos.'
                    : 'Importação concluída.'}
              </strong>
              <small title={importProgress.fileName}>{importProgress.fileName || 'Arquivos importados'}</small>
            </div>
            <div className="workspace-import-progress-percent">
              <strong>{importProgress.overallPercent}%</strong>
              <span>
                {importProgress.completedFiles.toLocaleString('pt-BR')}
                {' / '}
                {importProgress.totalFiles.toLocaleString('pt-BR')}
                {' arquivos'}
              </span>
            </div>
          </div>

          <div
            className="workspace-import-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={importProgress.overallPercent}
            aria-label="Progresso da importação"
          >
            <i style={{ width: String(importProgress.overallPercent) + '%' }} />
          </div>

          <div className="workspace-import-progress-meta">
            <span>
              <strong>Arquivo atual:</strong>{' '}
              {Math.min(importProgress.fileIndex + 1, importProgress.totalFiles).toLocaleString('pt-BR')}
              {' de '}
              {importProgress.totalFiles.toLocaleString('pt-BR')}
              {' · '}
              {importProgress.filePercent}% do arquivo
            </span>
            <span>
              <strong>Dados:</strong>{' '}
              {formatBytes(importProgress.loadedBytes)}
              {' / '}
              {formatBytes(importProgress.totalBytes)}
            </span>
            <span><strong>Tempo:</strong> {formatDuration(elapsedSeconds)}</span>
            <span>
              <strong>Restante:</strong>{' '}
              {remainingSeconds === null
                ? (busy ? 'calculando…' : 'concluído')
                : '~' + formatDuration(remainingSeconds)}
            </span>
          </div>
        </section>
      )}

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
                  disabled={busy}
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
          <span>Os arquivos processados ficam salvos localmente neste navegador até você limpar os dados.</span>
        </div>
        <div className="workspace-import-action-buttons">
          {files.length > 0 && (
            <button
              type="button"
              className="button workspace-clear-button"
              onClick={clearImportedData}
              disabled={busy}
            >
              Limpar dados importados
            </button>
          )}
          <button
            type="button"
            className="button primary large workspace-organize-button"
            disabled={!files.length || !matches.length || busy || restoring}
            onClick={onContinue}
          >
            Organizar dados e abrir módulos
          </button>
        </div>
      </div>
    </main>
  )
}
