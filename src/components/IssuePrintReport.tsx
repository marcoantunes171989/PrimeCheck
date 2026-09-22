import type { ClientComparison, ComparisonFieldResult } from '../types'
import StatusBadge from './StatusBadge'

export type IssuePrintItem = {
  client: ClientComparison
  field: ComparisonFieldResult
}

export default function IssuePrintReport({
  items,
  profileLabel,
  recordLabel,
  filterDescription,
}: {
  items: IssuePrintItem[]
  profileLabel: string
  recordLabel: string
  filterDescription: string
}) {
  if (!items.length) return null

  const generatedAt = new Date().toLocaleString('pt-BR')
  const fieldLabels = [...new Set(items.map(item => item.field.fieldLabel))]
  const analysisLabel = fieldLabels.length === 1
    ? fieldLabels[0]
    : `${fieldLabels.length} campos selecionados`

  return (
    <section className="issue-print-report" aria-hidden="true">
      <header className="issue-print-head">
        <span className="issue-print-brand">PrimeCheck · Conversão e Homologação</span>
        <h1>Relatório de divergências e atenções</h1>
        <p>
          {profileLabel} · análise do campo: <strong>{analysisLabel}</strong>
        </p>

        <div className="issue-print-summary">
          <div><span>Gerado em</span><strong>{generatedAt}</strong></div>
          <div><span>Ocorrências</span><strong>{items.length.toLocaleString('pt-BR')}</strong></div>
          <div><span>Filtro</span><strong>{filterDescription}</strong></div>
        </div>
      </header>

      <div className="issue-print-guidance">
        <strong>Objetivo do relatório</strong>
        <p>
          Documento de apoio para análise técnica da conversão. Cada linha demonstra o {recordLabel.toLowerCase()},
          o campo analisado, o valor da origem, o valor encontrado no destino, a classificação e o motivo gerado
          pelo PrimeCheck. Utilize estas informações para reproduzir e corrigir a regra de conversão.
        </p>
      </div>

      <table className="issue-print-table">
        <thead>
          <tr>
            <th>Código {recordLabel}</th>
            <th>Campo</th>
            <th>Origem</th>
            <th>Destino</th>
            <th>Status</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.client.key + '-' + item.field.fieldId + '-' + index}>
              <td>
                <strong className="mono">{item.client.key}</strong>
                <small>{item.client.name || '—'}</small>
              </td>
              <td>
                <strong>{item.field.fieldLabel}</strong>
                <small>{item.field.group}</small>
              </td>
              <td>{item.field.originValue || '—'}</td>
              <td>{item.field.targetValue || '—'}</td>
              <td><StatusBadge status={item.field.status} /></td>
              <td>{item.field.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="issue-print-footer">
        PrimeCheck · Relatório gerado para análise e correção da conversão de dados.
      </footer>
    </section>
  )
}
