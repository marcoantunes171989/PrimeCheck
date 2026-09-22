import type { DuplicateRecord } from '../types'

const RECORD_PREVIEW = 3
const CODE_PREVIEW = 4

export function DuplicateCodeList({
  codes,
  expanded,
  onToggle,
}: {
  codes: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const usable = codes.filter(Boolean)
  if (usable.length === 0) return <span className="muted-cell">—</span>

  const showAll = expanded || usable.length <= CODE_PREVIEW
  const visible = showAll ? usable : usable.slice(0, CODE_PREVIEW)
  const hidden = usable.length - visible.length

  return (
    <div className="dup-codes">
      {visible.map((code, index) => (
        <span key={`${code}-${index}`} className="dup-code-chip">{code}</span>
      ))}
      {usable.length > CODE_PREVIEW && (
        <button
          type="button"
          className="dup-expand"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher códigos' : `Ver todos os ${usable.length} códigos`}
        >
          {expanded ? 'Recolher' : `+${hidden}`}
        </button>
      )}
    </div>
  )
}

export default function DuplicateRecordList({
  groupId,
  fieldLabel,
  normalizedValue,
  records,
  expanded,
  onToggle,
  monoValue,
}: {
  groupId: string
  fieldLabel: string
  normalizedValue: string
  records: DuplicateRecord[]
  expanded: boolean
  onToggle: () => void
  monoValue: boolean
}) {
  if (records.length === 0) return <span className="muted-cell">—</span>

  const showAll = expanded || records.length <= RECORD_PREVIEW
  const visible = showAll ? records : records.slice(0, RECORD_PREVIEW)
  const listId = `dup-records-${groupId.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <div className="dup-record-list">
      <ul id={listId} className="dup-record-grid">
        {visible.map((record, index) => {
          const value = record.rawValue.trim() || normalizedValue
          return (
            <li key={`${record.key}-${index}`} className="dup-card">
              <div className="dup-card-head">
                <span className="dup-card-code">{record.key || '—'}</span>
                <strong>{record.name || 'Sem descrição'}</strong>
              </div>
              <div className="dup-card-hit">
                <span>{fieldLabel}</span>
                <strong className={monoValue ? 'mono' : undefined}>{value || '—'}</strong>
              </div>
              {record.extras.map(extra => (
                <div key={`${record.key}-${extra.label}`} className="dup-card-extra">
                  <span>{extra.label}</span>
                  <b>{extra.value}</b>
                </div>
              ))}
            </li>
          )
        })}
      </ul>
      {records.length > RECORD_PREVIEW && (
        <button
          type="button"
          className="dup-expand"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={listId}
        >
          {expanded ? 'Recolher' : `Ver todos os ${records.length} registros`}
        </button>
      )}
    </div>
  )
}
