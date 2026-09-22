import * as XLSX from 'xlsx'
import { getEntityProfile } from '../config/entities'
import type { ClientComparison, ComparisonReport } from '../types'

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvEscape = (value: unknown) => {
  const str = String(value ?? '')
  return `"${str.replace(/"/g, '""')}"`
}

export const exportClientsCsv = (
  clients: ClientComparison[],
  filename = 'primecheck_registros.csv',
  recordLabel = 'Registro',
) => {
  const header = ['Código', recordLabel, 'Encontrado', 'Resultado', 'Divergências', 'Atenções']
  const lines = [header.map(csvEscape).join(';')]
  clients.forEach(client => lines.push([
    client.key,
    client.name,
    client.found ? 'SIM' : 'NÃO',
    client.status,
    client.divergentCount,
    client.attentionCount,
  ].map(csvEscape).join(';')))
  downloadBlob(new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8' }), filename)
}

export const exportReportExcel = (report: ComparisonReport) => {
  const wb = XLSX.utils.book_new()
  const profile = getEntityProfile(report.profileId)
  const recordLabel = profile.recordLabel

  const summary = [
    ['PrimeCheck - Homologação de Conversão'],
    ['Perfil', profile.label],
    ['Gerado em', new Date(report.generatedAt).toLocaleString('pt-BR')],
    [],
    ['Indicador','Quantidade'],
    ['Registros origem', report.summary.originTotal],
    ['Registros destino', report.summary.targetTotal],
    ['Encontrados', report.summary.foundTotal],
    [`${profile.label} conformes`, report.summary.conformClients],
    [`${profile.label} divergentes`, report.summary.divergentClients],
    [`${profile.label} em atenção`, report.summary.attentionClients],
    ['Não importados', report.summary.notImportedClients],
    ['Somente no destino', report.summary.targetOnlyClients],
    ['Testes válidos', report.summary.validTests],
    ['Testes conformes', report.summary.conformTests],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Resumo')

  const clientRows = report.clients.map(c => ({
    Codigo: c.key,
    [recordLabel]: c.name,
    Encontrado: c.found ? 'SIM' : 'NÃO',
    Resultado: c.status,
    Divergencias: c.divergentCount,
    Atencoes: c.attentionCount,
    Inativo_Origem: c.originInactive ? 'SIM' : 'NÃO',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientRows), 'Registros')

  const issueRows = report.clients.flatMap(c => c.fields
    .filter(f => f.status !== 'CONFORME')
    .map(f => ({
      Codigo: c.key,
      Registro: c.name,
      Grupo: f.group,
      Campo: f.fieldLabel,
      Origem: f.originValue,
      Destino: f.targetValue,
      Status: f.status,
      Motivo: f.reason,
      Ajustado_Manualmente: f.manualAdjustment ? 'SIM' : 'NÃO',
      Destino_Original: f.manualAdjustment?.originalTargetValue ?? '',
      Destino_Ajustado: f.manualAdjustment?.adjustedValue ?? '',
      Observacao_Manual: f.manualAdjustment?.note ?? '',
      Data_Ajuste: f.manualAdjustment?.adjustedAt ?? '',
    })))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows), 'Divergencias')

  const manualRows = report.clients.flatMap(c => c.fields
    .filter(f => Boolean(f.manualAdjustment))
    .map(f => ({
      Codigo: c.key,
      Registro: c.name,
      Grupo: f.group,
      Campo: f.fieldLabel,
      Origem: f.originValue,
      Destino_Original: f.manualAdjustment!.originalTargetValue,
      Destino_Ajustado: f.manualAdjustment!.adjustedValue,
      Status_Apos_Ajuste: f.manualAdjustment!.status,
      Observacao: f.manualAdjustment!.note,
      Data_Ajuste: f.manualAdjustment!.adjustedAt,
    })))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(manualRows), 'Ajustes_Manuais')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.fieldSummary.map(f => ({
    Grupo: f.group,
    Campo: f.fieldLabel,
    Conformes: f.conform,
    Divergentes: f.divergent,
    Atencoes: f.attention,
    Nao_Validaveis: f.notValidatable,
    Percentual_Conformidade: f.conformityPercent === null ? '' : `${f.conformityPercent.toFixed(2)}%`,
  }))), 'Resumo_Campos')

  const duplicateRows = report.duplicates.flatMap(d => d.records.map(r => ({
    Arquivo: d.side,
    Campo: d.fieldLabel,
    Valor: d.normalizedValue,
    Quantidade: d.count,
    Codigo: r.key,
    Registro: r.name,
  })))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(duplicateRows), 'Duplicidades')

  const absentRows = report.clients.filter(c => !c.found).map(c => ({
    Codigo: c.key,
    Registro: c.name,
    Resultado: c.status,
    Inativo_Origem: c.originInactive ? 'SIM' : 'NÃO',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absentRows), 'Nao_Importados')

  const targetOnlyRows = report.targetOnly.map(item => ({ Codigo: item.key, Registro: item.name }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(targetOnlyRows), 'Somente_Destino')

  XLSX.writeFile(wb, `PrimeCheck_Homologacao_${new Date().toISOString().slice(0,10)}.xlsx`)
}
