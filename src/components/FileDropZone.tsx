import { useRef, useState } from 'react'
import type { ImportedFile } from '../types'
import { formatBytes, parseFiles } from '../lib/files'
import type { ParseFilesProgress } from '../lib/files'
import ImportProgressBar from './ImportProgressBar'

type Props = {
  title: string
  subtitle: string
  files: ImportedFile[]
  onChange: (files: ImportedFile[]) => void
  tone: 'origin' | 'target'
}

export default function FileDropZone({ title, subtitle, files, onChange, tone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<ParseFilesProgress | null>(null)

  const handle = async (list: FileList | File[]) => {
    const selected = Array.from(list)
    if (!selected.length || busy) return

    setBusy(true)
    setErrors([])
    setProgress({
      fileName: selected[0]?.name ?? '',
      fileIndex: 0,
      totalFiles: selected.length,
      completedFiles: 0,
      phase: 'reading',
      filePercent: 0,
      overallPercent: 0,
      loadedBytes: 0,
      totalBytes: selected.reduce((total, file) => total + Math.max(file.size, 1), 0),
    })

    try {
      const { parsed, errors: parseErrors } = await parseFiles(selected, next => setProgress(next))
      onChange([...files, ...parsed])
      setErrors(parseErrors)
      setProgress(current => current
        ? {
            ...current,
            phase: parseErrors.length ? 'error' : 'completed',
            filePercent: 100,
            overallPercent: 100,
            completedFiles: selected.length,
            loadedBytes: current.totalBytes,
          }
        : null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`drop-card ${tone}`}>
      <div className="drop-card-head">
        <div>
          <span className="eyebrow">{tone === 'origin' ? 'ORIGEM' : 'DESTINO'}</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="file-count">{files.length} {files.length === 1 ? 'arquivo/aba' : 'arquivos/abas'}</span>
      </div>

      <div
        className={`drop-zone ${drag ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault()
          setDrag(false)
          if (!busy) void handle(e.dataTransfer.files)
        }}
        onClick={() => {
          if (!busy) inputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onKeyDown={e => {
          if (!busy && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click()
        }}
      >
        <div className="upload-icon">⇧</div>
        <strong>{busy ? 'Lendo arquivos…' : 'Arraste arquivos aqui ou clique para selecionar'}</strong>
        <span>CSV, TXT, TSV, XLS, XLSX, XLSM, XLSB e ODS</span>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept=".csv,.txt,.tsv,.xls,.xlsx,.xlsm,.xlsb,.ods,.fods"
          onChange={e => {
            if (e.target.files) void handle(e.target.files)
            e.currentTarget.value = ''
          }}
        />
      </div>

      {progress && (
        <ImportProgressBar
          percent={progress.overallPercent}
          running={busy}
          compact
          title={
            busy
              ? progress.phase === 'processing'
                ? 'Processando arquivos…'
                : 'Carregando arquivos…'
              : progress.phase === 'error'
                ? 'Importação concluída com avisos.'
                : 'Importação concluída.'
          }
          detail={progress.fileName}
          meta={(
            <>
              <span>
                <strong>Arquivo:</strong>{' '}
                {Math.min(progress.fileIndex + 1, progress.totalFiles).toLocaleString('pt-BR')}
                {' / '}
                {progress.totalFiles.toLocaleString('pt-BR')}
              </span>
              <span><strong>Arquivo atual:</strong> {progress.filePercent}%</span>
              <span>
                <strong>Dados:</strong>{' '}
                {formatBytes(progress.loadedBytes)}
                {' / '}
                {formatBytes(progress.totalBytes)}
              </span>
            </>
          )}
        />
      )}

      {errors.length > 0 && <div className="inline-error">{errors.join(' • ')}</div>}

      {files.length > 0 && (
        <div className="file-list">
          {files.map(file => (
            <div className="file-item" key={file.id}>
              <div>
                <strong>{file.name}</strong>
                <span>{file.sheetName ? `${file.sheetName} · ` : ''}{file.rows.length.toLocaleString('pt-BR')} registros · {formatBytes(file.size)}</span>
              </div>
              <button className="icon-button" type="button" onClick={() => onChange(files.filter(f => f.id !== file.id))} aria-label="Remover arquivo">×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
