import type { DuplicateRecord } from '../types'
import {
  buildGroupDisplayColumns,
  isMonoDuplicateField,
  recordValueMap,
  type DuplicateDisplayContext,
} from '../lib/duplicateDisplay'

const RECORD_PREVIEW = 2
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

function DuplicateRecordTable({
  listId,
  records,
  columns,
  ctx,
}: {
  listId: string
  records: DuplicateRecord[]
  columns: Array<{ id: string; label: string }>
  ctx: DuplicateDisplayContext
}) {
  return (
    <div className="dup-record-table-wrap">
      <table id={listId} className="dup-record-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.id}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            const values = recordValueMap(record, ctx)
            return (
              <tr key={`${record.key}-${index}`}>
                {columns.map(column => {
                  const value = values.get(column.id)
                  return (
                    <td
                      key={column.id}
                      data-label={column.label}
                      className={isMonoDuplicateField(column.id) ? 'mono' : undefined}
                    >
                      {value || '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DuplicateGroupDetails({
  groupId,
  fieldId,
  fieldLabel,
  normalizedValue,
  nameLabel,
  records,
  codesExpanded,
  onToggleCodes,
  recordsExpanded,
  onToggleRecords,
  monoValue,
}: {
  groupId: string
  fieldId: string
  fieldLabel: string
  normalizedValue: string
  nameLabel: string
  records: DuplicateRecord[]
  codesExpanded: boolean
  onToggleCodes: () => void
  recordsExpanded: boolean
  onToggleRecords: () => void
  monoValue: boolean
}) {
  const ctx: DuplicateDisplayContext = { fieldId, fieldLabel, normalizedValue, nameLabel }
  const columns = buildGroupDisplayColumns(records, ctx)
  const showAll = recordsExpanded || records.length <= RECORD_PREVIEW
  const visible = showAll ? records : records.slice(0, RECORD_PREVIEW)
  const listId = `dup-records-${groupId.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <div className="dup-group-panel">
      <div className="dup-group-panel-head">
        <div className="dup-group-panel-copy">
          <span className="eyebrow">Detalhes do grupo</span>
          <strong>Registros com {fieldLabel} duplicado</strong>
        </div>
        <div className="dup-group-highlights">
          <div className="dup-value">
            <span>Valor duplicado</span>
            <strong className={monoValue ? 'mono' : undefined}>{normalizedValue || '—'}</strong>
          </div>
          <div className="dup-field">
            <span>Campo duplicado</span>
            <strong>{fieldLabel}</strong>
          </div>
        </div>
        <div className="dup-group-codes">
          <span>Códigos envolvidos</span>
          <DuplicateCodeList
            codes={records.map(record => record.key)}
            expanded={codesExpanded}
            onToggle={onToggleCodes}
          />
        </div>
      </div>

      <DuplicateRecordTable listId={listId} records={visible} columns={columns} ctx={ctx} />

      {records.length > RECORD_PREVIEW && (
        <div className="dup-group-panel-actions">
          <button
            type="button"
            className="dup-expand"
            onClick={onToggleRecords}
            aria-expanded={recordsExpanded}
            aria-controls={listId}
          >
            {recordsExpanded ? 'Recolher' : `Ver todos os ${records.length} registros`}
          </button>
        </div>
      )}
    </div>
  )
}

export default DuplicateGroupDetails
