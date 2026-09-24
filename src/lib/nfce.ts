export type NfceSummary = {
  id: string
  fileName: string
  size: number
  lastModified: number
  rawXml: string
  validXml: boolean
  isNfce: boolean
  errors: string[]
  accessKey: string
  number: string
  series: string
  issueDate: string
  issuerName: string
  issuerDocument: string
  recipientName: string
  recipientDocument: string
  city: string
  uf: string
  total: number
  protocol: string
  statusCode: string
  statusMessage: string
  environment: string
  itemCount: number
}

export type NfceItem = {
  index: string
  code: string
  ean: string
  eanTrib: string
  description: string
  ncm: string
  cest: string
  cfop: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
  icms: string
  pis: string
  cofins: string
}

export type NfcePayment = {
  methodCode: string
  methodLabel: string
  amount: number
}

export type NfceDetail = NfceSummary & {
  issuerAddress: string
  issuerFantasy: string
  issuerIe: string
  issuerPhone: string
  recipientAddress: string
  natureOperation: string
  items: NfceItem[]
  payments: NfcePayment[]
  discount: number
  productsTotal: number
  change: number
  taxesTotal: number
  additionalInfo: string
  qrCodeUrl: string
  consumerUrl: string
}

type XmlScope = Document | Element

const PAYMENT_LABELS: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de crédito',
  '04': 'Cartão de débito',
  '05': 'Crédito loja',
  '10': 'Vale alimentação',
  '11': 'Vale refeição',
  '12': 'Vale presente',
  '13': 'Vale combustível',
  '15': 'Boleto bancário',
  '16': 'Depósito bancário',
  '17': 'PIX',
  '18': 'Transferência / carteira digital',
  '19': 'Programa de fidelidade / cashback',
  '90': 'Sem pagamento',
  '99': 'Outros',
}

const local = (element: Element) => element.localName || element.tagName.replace(/^.*:/, '')

const elements = (scope: XmlScope, name: string): Element[] => {
  const namespaced = Array.from(scope.getElementsByTagNameNS('*', name))
  if (namespaced.length) return namespaced
  return Array.from(scope.getElementsByTagName(name))
}

const first = (scope: XmlScope | null | undefined, name: string): Element | null => {
  if (!scope) return null
  return elements(scope, name)[0] ?? null
}

const child = (scope: Element | null | undefined, name: string): Element | null => {
  if (!scope) return null
  return Array.from(scope.children).find(item => local(item) === name) ?? null
}

const text = (scope: XmlScope | null | undefined, name: string) =>
  first(scope, name)?.textContent?.trim() ?? ''

const childText = (scope: Element | null | undefined, name: string) =>
  child(scope, name)?.textContent?.trim() ?? ''

const num = (value: string) => {
  const parsed = Number(String(value || '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const docValue = (scope: XmlScope | null | undefined) =>
  text(scope, 'CNPJ') || text(scope, 'CPF')

const joinAddress = (address: Element | null) => {
  if (!address) return ''
  const parts = [
    childText(address, 'xLgr'),
    childText(address, 'nro'),
    childText(address, 'xCpl'),
    childText(address, 'xBairro'),
    childText(address, 'xMun'),
    childText(address, 'UF'),
    childText(address, 'CEP'),
  ].filter(Boolean)
  return parts.join(', ')
}

const parserError = (doc: Document) =>
  doc.getElementsByTagName('parsererror')[0]?.textContent?.trim() ?? ''

const parseDocument = (rawXml: string) => {
  const doc = new DOMParser().parseFromString(rawXml, 'application/xml')
  const error = parserError(doc)
  return { doc, error }
}

const buildId = (file: Pick<File, 'name' | 'size' | 'lastModified'>, accessKey = '') =>
  [file.name, file.size, file.lastModified, accessKey].join(':')

const statusEnvironment = (value: string) => value === '1' ? 'Produção' : value === '2' ? 'Homologação' : value || '—'

export const formatNfceDate = (value: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export const formatNfceMoney = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatAccessKey = (value: string) =>
  value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim()

export const formatNfceDocument = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return value
}

export async function parseNfceFile(file: File): Promise<NfceSummary> {
  let rawXml = ''
  const errors: string[] = []

  try {
    rawXml = await file.text()
  } catch {
    return {
      id: buildId(file),
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      rawXml: '',
      validXml: false,
      isNfce: false,
      errors: ['Não foi possível ler o arquivo XML.'],
      accessKey: '',
      number: '',
      series: '',
      issueDate: '',
      issuerName: '',
      issuerDocument: '',
      recipientName: '',
      recipientDocument: '',
      city: '',
      uf: '',
      total: 0,
      protocol: '',
      statusCode: '',
      statusMessage: '',
      environment: '',
      itemCount: 0,
    }
  }

  const { doc, error } = parseDocument(rawXml)
  if (error) errors.push('XML inválido ou malformado.')

  const infNFe = first(doc, 'infNFe')
  const ide = first(doc, 'ide')
  const emit = first(doc, 'emit')
  const dest = first(doc, 'dest')
  const enderEmit = first(emit, 'enderEmit')
  const total = first(doc, 'ICMSTot')
  const infProt = first(doc, 'infProt')

  const model = text(ide, 'mod')
  const isNfce = model === '65'
  if (!error && !infNFe) errors.push('Estrutura infNFe não localizada.')
  if (!error && model && model !== '65') errors.push(`Documento modelo ${model}; esperado modelo 65 (NFC-e).`)
  if (!error && !model) errors.push('Tag ide/mod não localizada.')

  const accessKey = (infNFe?.getAttribute('Id') || '').replace(/^NFe/i, '') || text(infProt, 'chNFe')
  if (accessKey && !/^\d{44}$/.test(accessKey)) errors.push('Chave de acesso não possui 44 dígitos.')

  const statusCode = text(infProt, 'cStat')
  const statusMessage = text(infProt, 'xMotivo')

  return {
    id: buildId(file, accessKey),
    fileName: file.name,
    size: file.size,
    lastModified: file.lastModified,
    rawXml,
    validXml: !error,
    isNfce,
    errors,
    accessKey,
    number: text(ide, 'nNF'),
    series: text(ide, 'serie'),
    issueDate: text(ide, 'dhEmi') || text(ide, 'dEmi'),
    issuerName: text(emit, 'xNome') || text(emit, 'xFant'),
    issuerDocument: docValue(emit),
    recipientName: text(dest, 'xNome'),
    recipientDocument: docValue(dest),
    city: text(enderEmit, 'xMun'),
    uf: text(enderEmit, 'UF'),
    total: num(text(total, 'vNF')),
    protocol: text(infProt, 'nProt'),
    statusCode,
    statusMessage,
    environment: statusEnvironment(text(ide, 'tpAmb') || text(infProt, 'tpAmb')),
    itemCount: elements(doc, 'det').length,
  }
}

export function parseNfceDetail(summary: NfceSummary): NfceDetail {
  const { doc } = parseDocument(summary.rawXml)
  const ide = first(doc, 'ide')
  const emit = first(doc, 'emit')
  const dest = first(doc, 'dest')
  const total = first(doc, 'ICMSTot')
  const pag = first(doc, 'pag')

  const items = elements(doc, 'det').map(det => {
    const prod = first(det, 'prod')
    const imposto = first(det, 'imposto')
    const icms = first(imposto, 'ICMS')
    const pis = first(imposto, 'PIS')
    const cofins = first(imposto, 'COFINS')

    return {
      index: det.getAttribute('nItem') || '',
      code: text(prod, 'cProd'),
      ean: text(prod, 'cEAN'),
      eanTrib: text(prod, 'cEANTrib'),
      description: text(prod, 'xProd'),
      ncm: text(prod, 'NCM'),
      cest: text(prod, 'CEST'),
      cfop: text(prod, 'CFOP'),
      unit: text(prod, 'uCom'),
      quantity: num(text(prod, 'qCom')),
      unitPrice: num(text(prod, 'vUnCom')),
      total: num(text(prod, 'vProd')),
      icms: text(icms, 'vICMS') || text(icms, 'pICMS') || text(icms, 'CSOSN') || text(icms, 'CST'),
      pis: text(pis, 'vPIS') || text(pis, 'CST'),
      cofins: text(cofins, 'vCOFINS') || text(cofins, 'CST'),
    }
  })

  const payments = pag
    ? elements(pag, 'detPag').map(item => {
        const methodCode = childText(item, 'tPag')
        return {
          methodCode,
          methodLabel: PAYMENT_LABELS[methodCode] || methodCode || 'Não informado',
          amount: num(childText(item, 'vPag')),
        }
      })
    : []

  return {
    ...summary,
    issuerAddress: joinAddress(first(emit, 'enderEmit')),
    issuerFantasy: text(emit, 'xFant'),
    issuerIe: text(emit, 'IE'),
    issuerPhone: text(first(emit, 'enderEmit'), 'fone'),
    recipientAddress: joinAddress(first(dest, 'enderDest')),
    natureOperation: text(ide, 'natOp'),
    items,
    payments,
    discount: num(text(total, 'vDesc')),
    productsTotal: num(text(total, 'vProd')),
    change: num(text(pag, 'vTroco')),
    taxesTotal: num(text(total, 'vTotTrib')),
    additionalInfo: text(first(doc, 'infAdic'), 'infCpl'),
    qrCodeUrl: text(first(doc, 'infNFeSupl'), 'qrCode'),
    consumerUrl: text(first(doc, 'infNFeSupl'), 'urlChave'),
  }
}

export const normalizeShortCean = (value: string) => {
  const normalized = String(value ?? '').trim()
  return /^\d{1,7}$/.test(normalized) ? normalized : ''
}

export const nfceSearchText = (item: NfceSummary) => [
  item.fileName,
  item.accessKey,
  item.number,
  item.series,
  item.issuerName,
  item.issuerDocument,
  item.recipientName,
  item.recipientDocument,
  item.city,
  item.uf,
  item.protocol,
  item.statusCode,
  item.statusMessage,
  item.environment,
  item.issueDate,
  formatNfceDate(item.issueDate),
  String(item.total),
  formatNfceMoney(item.total),
  String(item.itemCount),
  ...item.errors,
].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const normalizeNfceSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
