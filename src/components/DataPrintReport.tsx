import { statusClassName } from './StatusBadge'
import { formatReportDateTime } from '../lib/reportFormatting'

export type PrintColumn = {
  key: string
  label: string
}

export type PrintRow = Record<string, string | number>

const PRINT_STATUS_KEYS = new Set(['status', 'resultado', 'validade'])

function isStatusColumn(key: string) {
  return PRINT_STATUS_KEYS.has(key)
}

export default function DataPrintReport({
  title,
  subtitle,
  filterDescription,
  columns,
  rows,
}: {
  title: string
  subtitle: string
  filterDescription: string
  columns: PrintColumn[]
  rows: PrintRow[]
}) {
  if (!rows.length) return null

  return (
    <section className="generic-print-report" aria-hidden="true">
      <header className="generic-print-head">
        <span className="generic-print-brand">PrimeCheck · Conversão e Homologação</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="generic-print-summary">
          <div><span>Gerado em</span><strong>{formatReportDateTime()}</strong></div>
          <div><span>Registros</span><strong>{rows.length.toLocaleString('pt-BR')}</strong></div>
          <div><span>Filtros</span><strong>{filterDescription || 'Sem filtros adicionais'}</strong></div>
        </div>
      </header>

      <table className="generic-print-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className={isStatusColumn(column.key) ? 'print-status-col' : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(column => {
                const value = String(row[column.key] ?? '—')
                const statusCell = isStatusColumn(column.key)
                return (
                  <td key={column.key} className={statusCell ? 'print-status-col' : undefined}>
                    {statusCell && value !== '—'
                      ? <span className={statusClassName(value)}>{value}</span>
                      : value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
