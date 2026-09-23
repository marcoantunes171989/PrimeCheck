import { useEffect, useMemo, useState } from 'react'
import {
  formatNfceDate,
  formatNfceDocument,
  formatNfceMoney,
  normalizeNfceSearch,
  parseNfceDetail,
  type NfceDetail,
  type NfceSummary,
} from '../lib/nfce'
import { initializeWorkspaceScope, loadNfceDocuments } from '../lib/workspaceStorage'
import '../nfceAnalytics.css'

export type NfceAnalyticsView = 'overview' | 'products' | 'consumers' | 'barcodes'

type RangeMode = 7 | 14 | 21 | 30 | 60 | 90 | 'custom'
type SortDirection = 'asc' | 'desc'

type ProductRow = {
  key: string
  code: string
  barcode: string
  description: string
  ncm: string
  cfop: string
  quantity: number
  value: number
  coupons: number
  lastIssueDate: string
}

type ConsumerRow = {
  key: string
  name: string
  document: string
  coupons: number
  value: number
  average: number
  firstIssueDate: string
  lastIssueDate: string
}

type BarcodeRow = ProductRow

const PAGE_SIZE = 20
const detailCache = new Map<string, NfceDetail>()
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

const detailFor = (summary: NfceSummary) => {
  const cached = detailCache.get(summary.id)
  if (cached) return cached
  const detail = parseNfceDetail(summary)
  detailCache.set(summary.id, detail)
  return detail
}

const timestamp = (value: string) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const dayKey = (value: string) => {
  const time = timestamp(value)
  if (!time) return 'sem-data'
  const date = new Date(time)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const formatDay = (value: string) => {
  if (value === 'sem-data') return 'Sem data'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

const digits = (value: string) => value.replace(/\D/g, '')

const authorized = (item: NfceSummary) =>
  item.validXml && item.isNfce && item.statusCode === '100'

const toDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateInRange = (
  issueDate: string,
  mode: RangeMode,
  customStart: string,
  customEnd: string,
) => {
  const issue = timestamp(issueDate)
  if (!issue) return false

  if (mode === 'custom') {
    const start = customStart ? new Date(`${customStart}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY
    return issue >= start && issue <= end
  }

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - (mode - 1))
  start.setHours(0, 0, 0, 0)
  return issue >= start.getTime() && issue <= end.getTime()
}

const searchIncludes = (query: string, values: Array<string | number>) => {
  if (!query) return true
  return normalizeNfceSearch(values.join(' ')).includes(query)
}

const SortButton = ({
  label,
  field,
  sortKey,
  direction,
  onSort,
}: {
  label: string
  field: string
  sortKey: string
  direction: SortDirection
  onSort: (field: string) => void
}) => (
  <button type="button" className={sortKey === field ? 'active' : ''} onClick={() => onSort(field)}>
    {label}<span>{sortKey === field ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
  </button>
)

function DateFilter({
  mode,
  onModeChange,
  customStart,
  customEnd,
  onStartChange,
  onEndChange,
}: {
  mode: RangeMode
  onModeChange: (mode: RangeMode) => void
  customStart: string
  customEnd: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}) {
  const options: Array<7 | 14 | 21 | 30 | 60 | 90> = [7, 14, 21, 30, 60, 90]

  return (
    <div className="nfce-analytics-date-filter">
      <div className="nfce-range-buttons">
        {options.map(days => (
          <button
            type="button"
            key={days}
            className={mode === days ? 'active' : ''}
            onClick={() => onModeChange(days)}
          >
            {days} dias
          </button>
        ))}
        <button
          type="button"
          className={mode === 'custom' ? 'active' : ''}
          onClick={() => onModeChange('custom')}
        >
          Período
        </button>
      </div>
      {mode === 'custom' && (
        <div className="nfce-custom-range">
          <label>
            <span>De</span>
            <input type="date" value={customStart} onChange={event => onStartChange(event.target.value)} />
          </label>
          <label>
            <span>Até</span>
            <input type="date" value={customEnd} onChange={event => onEndChange(event.target.value)} />
          </label>
        </div>
      )}
    </div>
  )
}

const Pagination = ({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (page: number) => void
}) => (
  <div className="pagination nfce-analytics-pagination">
    <span>{total.toLocaleString('pt-BR')} registros · 20 por página</span>
    <button type="button" disabled={page <= 1} onClick={() => onPage(1)}>«</button>
    <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>‹</button>
    <span>Página {page} de {totalPages}</span>
    <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>›</button>
    <button type="button" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>»</button>
  </div>
)

export default function NfceAnalyticsPage({ view }: { view: NfceAnalyticsView }) {
  const [documents, setDocuments] = useState<NfceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeMode, setRangeMode] = useState<RangeMode>(30)
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 29)
    return toDateInput(date)
  })
  const [customEnd, setCustomEnd] = useState(() => toDateInput(new Date()))
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    void (async () => {
      await initializeWorkspaceScope()
      const stored = await loadNfceDocuments()
      if (!active) return
      setDocuments(stored)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    setSearch('')
    setPage(1)
    if (view === 'products') {
      setSortKey('quantity')
      setDirection('desc')
    } else if (view === 'consumers') {
      setSortKey('value')
      setDirection('desc')
    } else if (view === 'barcodes') {
      setSortKey('barcode')
      setDirection('asc')
    } else {
      setSortKey('')
      setDirection('desc')
    }
  }, [view])

  useEffect(() => {
    setPage(1)
  }, [search, rangeMode, customStart, customEnd, sortKey, direction])

  const authorizedDocuments = useMemo(
    () => documents.filter(authorized),
    [documents],
  )

  const periodDocuments = useMemo(
    () => authorizedDocuments.filter(item => dateInRange(item.issueDate, rangeMode, customStart, customEnd)),
    [authorizedDocuments, customEnd, customStart, rangeMode],
  )

  const periodDetails = useMemo(
    () => periodDocuments.map(summary => ({ summary, detail: detailFor(summary) })),
    [periodDocuments],
  )

  const productRows = useMemo<ProductRow[]>(() => {
    const map = new Map<string, ProductRow & { couponIds: Set<string> }>()

    periodDetails.forEach(({ summary, detail }) => {
      detail.items.forEach(item => {
        const primaryBarcode = digits(item.ean) || digits(item.eanTrib)
        const key = primaryBarcode || item.code || normalizeNfceSearch(item.description)
        if (!key) return

        const current = map.get(key) ?? {
          key,
          code: item.code,
          barcode: primaryBarcode,
          description: item.description || 'Sem descrição',
          ncm: item.ncm,
          cfop: item.cfop,
          quantity: 0,
          value: 0,
          coupons: 0,
          lastIssueDate: '',
          couponIds: new Set<string>(),
        }

        current.quantity += item.quantity
        current.value += item.total
        current.couponIds.add(summary.id)
        if (timestamp(summary.issueDate) > timestamp(current.lastIssueDate)) current.lastIssueDate = summary.issueDate
        map.set(key, current)
      })
    })

    return [...map.values()].map(row => ({
      ...row,
      coupons: row.couponIds.size,
    }))
  }, [periodDetails])

  const consumerRows = useMemo<ConsumerRow[]>(() => {
    const map = new Map<string, ConsumerRow>()

    periodDetails.forEach(({ summary, detail }) => {
      const name = detail.recipientName.trim()
      const document = digits(detail.recipientDocument)
      if (!name && !document) return

      const key = document || normalizeNfceSearch(name)
      const current = map.get(key) ?? {
        key,
        name: name || 'Consumidor identificado sem nome',
        document,
        coupons: 0,
        value: 0,
        average: 0,
        firstIssueDate: summary.issueDate,
        lastIssueDate: summary.issueDate,
      }

      current.coupons += 1
      current.value += summary.total
      if (timestamp(summary.issueDate) < timestamp(current.firstIssueDate)) current.firstIssueDate = summary.issueDate
      if (timestamp(summary.issueDate) > timestamp(current.lastIssueDate)) current.lastIssueDate = summary.issueDate
      current.average = current.coupons ? current.value / current.coupons : 0
      map.set(key, current)
    })

    return [...map.values()]
  }, [periodDetails])

  const shortBarcodeRows = useMemo<BarcodeRow[]>(() => {
    const map = new Map<string, BarcodeRow & { couponIds: Set<string> }>()

    periodDetails.forEach(({ summary, detail }) => {
      detail.items.forEach(item => {
        const candidates = [digits(item.ean), digits(item.eanTrib)]
          .filter(value => value.length > 0 && value.length < 8)
        ;[...new Set(candidates)].forEach(barcode => {
          const key = `${barcode}|${item.code}|${item.description}`
          const current = map.get(key) ?? {
            key,
            code: item.code,
            barcode,
            description: item.description || 'Sem descrição',
            ncm: item.ncm,
            cfop: item.cfop,
            quantity: 0,
            value: 0,
            coupons: 0,
            lastIssueDate: '',
            couponIds: new Set<string>(),
          }
          current.quantity += item.quantity
          current.value += item.total
          current.couponIds.add(summary.id)
          if (timestamp(summary.issueDate) > timestamp(current.lastIssueDate)) current.lastIssueDate = summary.issueDate
          map.set(key, current)
        })
      })
    })

    return [...map.values()].map(row => ({
      ...row,
      coupons: row.couponIds.size,
    }))
  }, [periodDetails])

  const monthDocuments = useMemo(() => {
    const now = new Date()
    return authorizedDocuments.filter(item => {
      const time = timestamp(item.issueDate)
      if (!time) return false
      const date = new Date(time)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    })
  }, [authorizedDocuments])

  const maxMonth = monthDocuments.length ? [...monthDocuments].sort((a, b) => b.total - a.total)[0] : null
  const minMonth = monthDocuments.length ? [...monthDocuments].sort((a, b) => a.total - b.total)[0] : null
  const maxAll = authorizedDocuments.length ? [...authorizedDocuments].sort((a, b) => b.total - a.total)[0] : null
  const minAll = authorizedDocuments.length ? [...authorizedDocuments].sort((a, b) => a.total - b.total)[0] : null

  const periodValue = periodDocuments.reduce((sum, item) => sum + item.total, 0)
  const identifiedConsumers = consumerRows.length

  const dailyRows = useMemo(() => {
    const map = new Map<string, { key: string; coupons: number; value: number }>()
    periodDocuments.forEach(item => {
      const key = dayKey(item.issueDate)
      const current = map.get(key) ?? { key, coupons: 0, value: 0 }
      current.coupons += 1
      current.value += item.total
      map.set(key, current)
    })
    return [...map.values()].sort((a, b) => collator.compare(a.key, b.key))
  }, [periodDocuments])

  const changeSort = (field: string) => {
    if (sortKey === field) {
      setDirection(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(field)
      setDirection('asc')
    }
  }

  const productFiltered = useMemo(() => {
    const query = normalizeNfceSearch(search)
    const rows = productRows.filter(row => searchIncludes(query, [
      row.code, row.barcode, row.description, row.ncm, row.cfop,
      row.quantity, row.value, row.coupons, formatNfceDate(row.lastIssueDate),
    ]))
    return rows.sort((left, right) => {
      const factor = direction === 'asc' ? 1 : -1
      let result = 0
      if (sortKey === 'description') result = collator.compare(left.description, right.description)
      else if (sortKey === 'code') result = collator.compare(left.code, right.code)
      else if (sortKey === 'barcode') result = collator.compare(left.barcode, right.barcode)
      else if (sortKey === 'ncm') result = collator.compare(left.ncm, right.ncm)
      else if (sortKey === 'cfop') result = collator.compare(left.cfop, right.cfop)
      else if (sortKey === 'value') result = left.value - right.value
      else if (sortKey === 'coupons') result = left.coupons - right.coupons
      else if (sortKey === 'lastIssueDate') result = timestamp(left.lastIssueDate) - timestamp(right.lastIssueDate)
      else result = left.quantity - right.quantity
      return result * factor
    })
  }, [direction, productRows, search, sortKey])

  const consumerFiltered = useMemo(() => {
    const query = normalizeNfceSearch(search)
    const rows = consumerRows.filter(row => searchIncludes(query, [
      row.name, row.document, row.coupons, row.value, row.average,
      formatNfceDate(row.firstIssueDate), formatNfceDate(row.lastIssueDate),
    ]))
    return rows.sort((left, right) => {
      const factor = direction === 'asc' ? 1 : -1
      let result = 0
      if (sortKey === 'name') result = collator.compare(left.name, right.name)
      else if (sortKey === 'document') result = collator.compare(left.document, right.document)
      else if (sortKey === 'coupons') result = left.coupons - right.coupons
      else if (sortKey === 'average') result = left.average - right.average
      else if (sortKey === 'firstIssueDate') result = timestamp(left.firstIssueDate) - timestamp(right.firstIssueDate)
      else if (sortKey === 'lastIssueDate') result = timestamp(left.lastIssueDate) - timestamp(right.lastIssueDate)
      else result = left.value - right.value
      return result * factor
    })
  }, [consumerRows, direction, search, sortKey])

  const barcodeFiltered = useMemo(() => {
    const query = normalizeNfceSearch(search)
    const rows = shortBarcodeRows.filter(row => searchIncludes(query, [
      row.barcode, row.code, row.description, row.ncm, row.cfop,
      row.quantity, row.value, row.coupons, formatNfceDate(row.lastIssueDate),
    ]))
    return rows.sort((left, right) => {
      const factor = direction === 'asc' ? 1 : -1
      let result = 0
      if (sortKey === 'description') result = collator.compare(left.description, right.description)
      else if (sortKey === 'code') result = collator.compare(left.code, right.code)
      else if (sortKey === 'ncm') result = collator.compare(left.ncm, right.ncm)
      else if (sortKey === 'cfop') result = collator.compare(left.cfop, right.cfop)
      else if (sortKey === 'quantity') result = left.quantity - right.quantity
      else if (sortKey === 'value') result = left.value - right.value
      else if (sortKey === 'coupons') result = left.coupons - right.coupons
      else if (sortKey === 'lastIssueDate') result = timestamp(left.lastIssueDate) - timestamp(right.lastIssueDate)
      else result = collator.compare(left.barcode, right.barcode)
      return result * factor
    })
  }, [direction, search, shortBarcodeRows, sortKey])

  const currentRows = view === 'products'
    ? productFiltered
    : view === 'consumers'
      ? consumerFiltered
      : barcodeFiltered

  const totalPages = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = currentRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const topQuantity = [...productRows].sort((a, b) => b.quantity - a.quantity).slice(0, 10)
  const topValue = [...productRows].sort((a, b) => b.value - a.value).slice(0, 10)
  const maxQuantity = Math.max(1, ...topQuantity.map(item => item.quantity))
  const maxValue = Math.max(1, ...topValue.map(item => item.value))
  const maxDailyValue = Math.max(1, ...dailyRows.map(item => item.value))

  const title = view === 'overview'
    ? 'Visão Geral NFC-e'
    : view === 'products'
      ? 'Produtos mais vendidos'
      : view === 'consumers'
        ? 'Consumidores identificados'
        : 'Códigos de barras menores que 8 dígitos'

  return (
    <main className="nfce-analytics-page">
      <header className="nfce-analytics-hero">
        <div>
          <span className="eyebrow">ANÁLISE NFC-e · XML MODELO 65</span>
          <h1>{title}</h1>
          <p>
            Indicadores calculados a partir das NFC-e autorizadas armazenadas no PrimeCheck para este ambiente.
          </p>
        </div>
        <div className="nfce-analytics-source">
          <strong>{authorizedDocuments.length.toLocaleString('pt-BR')}</strong>
          <span>NFC-e autorizadas disponíveis</span>
        </div>
      </header>

      <DateFilter
        mode={rangeMode}
        onModeChange={setRangeMode}
        customStart={customStart}
        customEnd={customEnd}
        onStartChange={setCustomStart}
        onEndChange={setCustomEnd}
      />

      {loading ? (
        <section className="nfce-analytics-empty">
          <strong>Carregando informações NFC-e…</strong>
        </section>
      ) : authorizedDocuments.length === 0 ? (
        <section className="nfce-analytics-empty">
          <strong>Nenhuma NFC-e autorizada disponível.</strong>
          <span>Importe os XMLs no submenu Documentos NFC-e para alimentar os indicadores.</span>
        </section>
      ) : view === 'overview' ? (
        <>
          <section className="nfce-analytics-kpis">
            <article><span>Cupons no mês</span><strong>{monthDocuments.length.toLocaleString('pt-BR')}</strong><small>mês calendário atual</small></article>
            <article><span>Maior cupom no mês</span><strong>{maxMonth ? formatNfceMoney(maxMonth.total) : '—'}</strong><small>{maxMonth ? `Nº ${maxMonth.number} · ${formatNfceDate(maxMonth.issueDate)}` : 'sem registros'}</small></article>
            <article><span>Maior cupom importado</span><strong>{maxAll ? formatNfceMoney(maxAll.total) : '—'}</strong><small>{maxAll ? `Nº ${maxAll.number} · ${formatNfceDate(maxAll.issueDate)}` : 'sem registros'}</small></article>
            <article><span>Menor cupom no mês</span><strong>{minMonth ? formatNfceMoney(minMonth.total) : '—'}</strong><small>{minMonth ? `Nº ${minMonth.number} · ${formatNfceDate(minMonth.issueDate)}` : 'sem registros'}</small></article>
            <article><span>Menor cupom importado</span><strong>{minAll ? formatNfceMoney(minAll.total) : '—'}</strong><small>{minAll ? `Nº ${minAll.number} · ${formatNfceDate(minAll.issueDate)}` : 'sem registros'}</small></article>
          </section>

          <section className="nfce-analytics-kpis compact">
            <article><span>Cupons no período</span><strong>{periodDocuments.length.toLocaleString('pt-BR')}</strong><small>somente autorizadas</small></article>
            <article><span>Valor no período</span><strong>{formatNfceMoney(periodValue)}</strong><small>soma de vNF</small></article>
            <article><span>Consumidores identificados</span><strong>{identifiedConsumers.toLocaleString('pt-BR')}</strong><small>nome e/ou documento no XML</small></article>
            <article><span>Produtos distintos</span><strong>{productRows.length.toLocaleString('pt-BR')}</strong><small>no período selecionado</small></article>
          </section>

          <section className="nfce-analytics-grid">
            <article className="nfce-analytics-card">
              <div className="nfce-analytics-card-head">
                <div><span className="eyebrow">MOVIMENTO</span><h2>Cupons e valor por data</h2></div>
                <small>ordem crescente</small>
              </div>
              <div className="nfce-daily-list">
                {dailyRows.map(row => (
                  <div key={row.key}>
                    <div><strong>{formatDay(row.key)}</strong><small>{row.coupons} cupons</small></div>
                    <span><i style={{ width: `${Math.max(3, row.value / maxDailyValue * 100)}%` }} /></span>
                    <b>{formatNfceMoney(row.value)}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="nfce-analytics-card">
              <div className="nfce-analytics-card-head">
                <div><span className="eyebrow">RANKING</span><h2>Top produtos por quantidade</h2></div>
                <small>Top 10</small>
              </div>
              <div className="nfce-ranking-list">
                {topQuantity.map((item, index) => (
                  <div key={item.key}>
                    <b>{index + 1}</b>
                    <div><strong>{item.description}</strong><small>{item.code || 'sem código'} · {item.barcode || 'sem GTIN'}</small></div>
                    <span><i style={{ width: `${Math.max(4, item.quantity / maxQuantity * 100)}%` }} /></span>
                    <em>{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</em>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : (
        <>
          {view === 'products' && (
            <section className="nfce-analytics-grid">
              <article className="nfce-analytics-card">
                <div className="nfce-analytics-card-head">
                  <div><span className="eyebrow">RANKING</span><h2>Mais vendidos por quantidade</h2></div>
                  <small>Top 10</small>
                </div>
                <div className="nfce-ranking-list">
                  {topQuantity.map((item, index) => (
                    <div key={item.key}>
                      <b>{index + 1}</b>
                      <div><strong>{item.description}</strong><small>{item.code || 'sem código'}</small></div>
                      <span><i style={{ width: `${Math.max(4, item.quantity / maxQuantity * 100)}%` }} /></span>
                      <em>{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</em>
                    </div>
                  ))}
                </div>
              </article>
              <article className="nfce-analytics-card">
                <div className="nfce-analytics-card-head">
                  <div><span className="eyebrow">RANKING</span><h2>Mais vendidos por valor</h2></div>
                  <small>Top 10</small>
                </div>
                <div className="nfce-ranking-list value">
                  {topValue.map((item, index) => (
                    <div key={item.key}>
                      <b>{index + 1}</b>
                      <div><strong>{item.description}</strong><small>{item.code || 'sem código'}</small></div>
                      <span><i style={{ width: `${Math.max(4, item.value / maxValue * 100)}%` }} /></span>
                      <em>{formatNfceMoney(item.value)}</em>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          <section className="nfce-analytics-card nfce-analytics-table-card">
            <div className="nfce-analytics-card-head table">
              <div>
                <span className="eyebrow">
                  {view === 'products' ? 'PRODUTOS DO PERÍODO' : view === 'consumers' ? 'CONSUMIDORES' : 'ANÁLISE DE GTIN'}
                </span>
                <h2>{title}</h2>
              </div>
              <small>{currentRows.length.toLocaleString('pt-BR')} resultados</small>
            </div>

            <div className="nfce-analytics-search">
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Pesquisar em todos os campos da lista..."
                aria-label="Pesquisar em todos os campos"
              />
            </div>

            <div className="nfce-analytics-table-wrap">
              {view === 'consumers' ? (
                <table className="nfce-analytics-table">
                  <thead><tr>
                    <th><SortButton label="Consumidor" field="name" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="CPF/CNPJ" field="document" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Cupons" field="coupons" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Valor" field="value" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Ticket médio" field="average" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Primeira compra" field="firstIssueDate" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Última compra" field="lastIssueDate" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                  </tr></thead>
                  <tbody>
                    {(pageRows as ConsumerRow[]).map(row => (
                      <tr key={row.key}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.document ? formatNfceDocument(row.document) : '—'}</td>
                        <td>{row.coupons.toLocaleString('pt-BR')}</td>
                        <td><strong>{formatNfceMoney(row.value)}</strong></td>
                        <td>{formatNfceMoney(row.average)}</td>
                        <td>{formatNfceDate(row.firstIssueDate)}</td>
                        <td>{formatNfceDate(row.lastIssueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="nfce-analytics-table">
                  <thead><tr>
                    {view === 'barcodes' && <th><SortButton label="Código de barras" field="barcode" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>}
                    <th><SortButton label="Código" field="code" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    {view === 'products' && <th><SortButton label="Código de barras" field="barcode" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>}
                    <th><SortButton label="Descrição" field="description" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="NCM" field="ncm" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="CFOP" field="cfop" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Quantidade" field="quantity" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Valor" field="value" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Cupons" field="coupons" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                    <th><SortButton label="Última emissão" field="lastIssueDate" sortKey={sortKey} direction={direction} onSort={changeSort} /></th>
                  </tr></thead>
                  <tbody>
                    {(pageRows as ProductRow[]).map(row => (
                      <tr key={row.key}>
                        {view === 'barcodes' && <td><code className="nfce-short-barcode">{row.barcode}</code></td>}
                        <td>{row.code || '—'}</td>
                        {view === 'products' && <td>{row.barcode || '—'}</td>}
                        <td><strong>{row.description}</strong></td>
                        <td>{row.ncm || '—'}</td>
                        <td>{row.cfop || '—'}</td>
                        <td>{row.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                        <td><strong>{formatNfceMoney(row.value)}</strong></td>
                        <td>{row.coupons.toLocaleString('pt-BR')}</td>
                        <td>{formatNfceDate(row.lastIssueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination page={safePage} totalPages={totalPages} total={currentRows.length} onPage={setPage} />
          </section>
        </>
      )}
    </main>
  )
}
