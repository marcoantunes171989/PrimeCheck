export type PrintColumn = {
  key: string
  label: string
}

export type PrintRow = Record<string, string | number>

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
          <div><span>Gerado em</span><strong>{new Date().toLocaleString('pt-BR')}</strong></div>
          <div><span>Registros</span><strong>{rows.length.toLocaleString('pt-BR')}</strong></div>
          <div><span>Filtros</span><strong>{filterDescription || 'Sem filtros adicionais'}</strong></div>
        </div>
      </header>

      <table className="generic-print-table">
        <thead>
          <tr>
            {columns.map(column => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(column => <td key={column.key}>{String(row[column.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
