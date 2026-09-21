import { useRef, useState } from 'react'
import type { ImportedFile } from '../types'
import { formatBytes, parseFiles } from '../lib/files'

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

  const handle = async (list: FileList | File[]) => {
    setBusy(true)
    setErrors([])
    const { parsed, errors: parseErrors } = await parseFiles(Array.from(list))
    onChange([...files, ...parsed])
    setErrors(parseErrors)
    setBusy(false)
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
        className={`drop-zone ${drag ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
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
          onChange={e => e.target.files && void handle(e.target.files)}
        />
      </div>

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
