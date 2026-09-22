import type { DuplicateItem } from '../types'
import {
  buildGroupDisplayColumns,
  buildRecordDisplayFields,
  recordValueMap,
  sideLabel,
  type DuplicateDisplayContext,
} from './duplicateDisplay'

export interface DuplicatePrintMeta {
  entityLabel: string
  generatedAt: string
  filterLabel: string
  nameLabel: string
}

const PRINT_GUIDANCE =
  'Os registros abaixo possuem informações duplicadas no campo indicado. É necessário validar manualmente qual cadastro deve ser considerado principal para a conversão/importação. Na ausência de uma regra específica e confiável de prioridade, o processo poderá considerar um registro de forma não determinística, sendo recomendada análise prévia.'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatDateTime = (value: string) => {
  const date = new Date(value)
  const usable = Number.isNaN(date.getTime()) ? new Date() : date
  return usable.toLocaleString('pt-BR')
}

const printStyles = `
  :root {
    --primary: #012e46;
    --primary-2: #0a496d;
    --accent: #f38525;
    --muted: #6b7280;
    --border: #d1d5db;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  @page { size: A4; margin: 12mm 11mm; }
  .page {
    page-break-after: always;
    break-after: page;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--primary);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mark {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--primary);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 16px;
  }
  .brand strong {
    display: block;
    color: var(--primary);
    font-size: 16px;
    letter-spacing: -.02em;
  }
  .brand span {
    display: block;
    color: var(--muted);
    font-size: 10px;
  }
  .meta {
    text-align: right;
    color: var(--muted);
    font-size: 10px;
  }
  .meta b {
    display: block;
    color: var(--primary);
    font-size: 15px;
    margin: 2px 0 4px;
  }
  .guidance {
    margin: 12px 0;
    padding: 10px 12px;
    border: 1px solid #f0d3ac;
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    background: #fff9f2;
    color: #7a5b3d;
    font-size: 11px;
    line-height: 1.5;
  }
  .group {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #d7e3ea;
    border-radius: 10px;
    background: #f7fbfd;
  }
  .group h2 {
    margin: 0 0 10px;
    color: var(--primary);
    font-size: 14px;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .fact {
    padding: 8px 9px;
    border: 1px solid #d7e3ea;
    border-radius: 8px;
    background: #fff;
  }
  .fact span {
    display: block;
    color: var(--muted);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .fact strong {
    display: block;
    margin-top: 3px;
    color: var(--primary);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .fact.hit {
    border-color: #f0d3ac;
    background: #fff9f2;
  }
  .fact.hit span { color: #9a5c21; }
  .fact.hit strong { color: #714313; }
  .codes {
    grid-column: 1 / -1;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border: 1px solid #d7e3ea;
    border-radius: 999px;
    background: #f5f8fa;
    color: var(--primary);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 10px;
    font-weight: 700;
  }
  .records-title {
    margin: 14px 0 8px;
    color: var(--primary);
    font-size: 12px;
  }
  .record {
    margin: 0 0 8px;
    padding: 8px 10px;
    border: 1px solid #d7e3ea;
    border-radius: 8px;
    background: #fff;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .record-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 12px;
  }
  .cell span {
    display: block;
    color: var(--muted);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .03em;
    text-transform: uppercase;
  }
  .cell strong {
    display: block;
    margin-top: 1px;
    color: #1f2d35;
    font-size: 11px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .cell.wide { grid-column: span 2; }
  .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; }
  @media print {
    .page { padding: 0; }
  }
`

const renderRecord = (item: DuplicateItem, ctx: DuplicateDisplayContext) => {
  const columns = buildGroupDisplayColumns(item.records, ctx)
  return item.records.map((record, index) => {
    const values = recordValueMap(record, ctx)
    const fields = buildRecordDisplayFields(record, ctx)
    const cells = columns.map(column => {
      const meta = fields.find(field => field.id === column.id)
      const value = values.get(column.id) || '—'
      const wide = column.id === '__nome'
      const mono = column.id === '__codigo' || column.id === 'cpfCnpj' || column.id === 'ie' || column.id === 'rg' || column.id === ctx.fieldId
      return `
        <div class="cell${wide ? ' wide' : ''}">
          <span>${escapeHtml(meta?.label || column.label)}</span>
          <strong class="${mono ? 'mono' : ''}">${escapeHtml(value)}</strong>
        </div>
      `
    }).join('')
    return `<article class="record" aria-label="Registro ${index + 1}">
      <div class="record-grid">${cells}</div>
    </article>`
  }).join('')
}

const renderGroupPage = (
  item: DuplicateItem,
  groupNumber: number,
  meta: DuplicatePrintMeta,
) => {
  const ctx: DuplicateDisplayContext = {
    fieldId: item.fieldId,
    fieldLabel: item.fieldLabel,
    normalizedValue: item.normalizedValue,
    nameLabel: meta.nameLabel,
  }
  const codes = item.records.map(record => record.key).filter(Boolean)
  const chips = codes.length
    ? codes.map(code => `<span class="chip">${escapeHtml(code)}</span>`).join('')
    : '<span>—</span>'

  return `
    <section class="page">
      <header class="header">
        <div class="brand">
          <div class="mark">P</div>
          <div>
            <strong>PrimeCheck</strong>
            <span>Conferência de cadastros</span>
          </div>
        </div>
        <div class="meta">
          Relatório de Duplicidades
          <b>${escapeHtml(meta.entityLabel)}</b>
          Gerado em ${escapeHtml(formatDateTime(meta.generatedAt))}<br />
          Filtro: ${escapeHtml(meta.filterLabel)}
        </div>
      </header>
      <p class="guidance">${escapeHtml(PRINT_GUIDANCE)}</p>
      <div class="group">
        <h2>Grupo ${groupNumber}</h2>
        <div class="facts">
          <div class="fact">
            <span>Lado</span>
            <strong>${escapeHtml(sideLabel(item.side))}</strong>
          </div>
          <div class="fact">
            <span>Campo duplicado</span>
            <strong>${escapeHtml(item.fieldLabel)}</strong>
          </div>
          <div class="fact">
            <span>Tipo</span>
            <strong>${escapeHtml(item.category)}</strong>
          </div>
          <div class="fact hit">
            <span>Valor duplicado</span>
            <strong class="mono">${escapeHtml(item.normalizedValue || '—')}</strong>
          </div>
          <div class="fact">
            <span>Quantidade de registros</span>
            <strong>${item.count} ${item.count === 1 ? 'registro' : 'registros'}</strong>
          </div>
          <div class="fact codes">
            <span>Códigos envolvidos</span>
            <div class="chips">${chips}</div>
          </div>
        </div>
      </div>
      <h3 class="records-title">Registros do grupo</h3>
      ${renderRecord(item, ctx)}
    </section>
  `
}

const buildPrintDocument = (groups: DuplicateItem[], meta: DuplicatePrintMeta, numberStart: number) => {
  const pages = groups.map((group, index) => renderGroupPage(group, numberStart + index, meta)).join('')
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Relatório de Duplicidades — PrimeCheck</title>
    <style>${printStyles}</style>
  </head>
  <body>${pages}</body>
</html>`
}

export function printDuplicateReport(
  groups: DuplicateItem[],
  meta: DuplicatePrintMeta,
  options?: { numberStart?: number },
) {
  if (!groups.length) return

  const html = buildPrintDocument(groups, meta, options?.numberStart ?? 1)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    URL.revokeObjectURL(url)
    iframe.remove()
  }

  iframe.addEventListener('load', () => {
    const frameWindow = iframe.contentWindow
    if (!frameWindow) {
      cleanup()
      return
    }
    frameWindow.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)
    window.setTimeout(() => {
      frameWindow.focus()
      frameWindow.print()
    }, 50)
  }, { once: true })
  iframe.src = url
  document.body.appendChild(iframe)
}
