import type { CellValue, FieldDefinition } from '../types'

export const asText = (value: CellValue): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

export const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const normalizeHeader = (value: string) => stripAccents(value)
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

export const onlyDigits = (value: CellValue) => asText(value).replace(/\D/g, '')

export const normalizeAlphanumericDocument = (value: CellValue) => asText(value)
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')

export const normalizeCode = (value: CellValue) => {
  const raw = asText(value)
  if (!raw) return ''
  const numeric = raw.replace(/\.0+$/, '')
  if (/^0+\d+$/.test(numeric)) return numeric.replace(/^0+/, '') || '0'
  return stripAccents(numeric).toUpperCase().replace(/\s+/g, ' ').trim()
}

export const normalizeText = (value: CellValue) => stripAccents(asText(value))
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim()

export const normalizePhone = (value: CellValue) => onlyDigits(value)

export const normalizeIE = (value: CellValue) => asText(value)
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')

export const normalizePersonType = (value: CellValue) => {
  const v = normalizeText(value)
  if (!v) return ''
  if (['F','PF','FISICA','PESSOA FISICA','PESSOAFISICA'].includes(v)) return 'F'
  if (['J','PJ','JURIDICA','PESSOA JURIDICA','PESSOAJURIDICA'].includes(v)) return 'J'
  return v
}

export const normalizeBoolean = (value: CellValue) => {
  const v = normalizeText(value)
  if (!v) return ''
  if (['S','SIM','Y','YES','1','TRUE','ATIVO'].includes(v)) return 'S'
  if (['N','NAO','NÃO','NO','0','FALSE','INATIVO'].includes(v)) return 'N'
  return v
}

export const normalizeSex = (value: CellValue) => {
  const v = normalizeText(value)
  if (!v) return ''
  if (['M','MASCULINO','HOMEM'].includes(v)) return 'M'
  if (['F','FEMININO','MULHER'].includes(v)) return 'F'
  return v
}

export const normalizeState = (value: CellValue) => normalizeText(value).replace(/[^A-Z]/g, '')

const parseBrazilianNumber = (raw: string): number | null => {
  let v = raw.trim().replace(/R\$/gi, '').replace(/\s/g, '')
  if (!v) return null
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(v) || /^-?\d+,\d+$/.test(v)) {
    v = v.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(,\d{3})*\.\d+$/.test(v)) {
    v = v.replace(/,/g, '')
  } else if (v.includes(',') && !v.includes('.')) {
    v = v.replace(',', '.')
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const normalizeMoney = (value: CellValue) => {
  const n = parseBrazilianNumber(asText(value))
  return n === null ? normalizeText(value) : n.toFixed(2)
}

const excelSerialToDate = (serial: number) => {
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  const date = new Date(utcValue * 1000)
  return Number.isNaN(date.getTime()) ? null : date
}

export const normalizeDate = (value: CellValue) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = asText(value)
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const br = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (br) {
    let [, d, m, y] = br
    if (y.length === 2) y = Number(y) >= 50 ? `19${y}` : `20${y}`
    return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw)
    if (serial > 1 && serial < 100000) {
      const d = excelSerialToDate(serial)
      if (d) return d.toISOString().slice(0, 10)
    }
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? normalizeText(raw) : parsed.toISOString().slice(0, 10)
}

export const normalizeForField = (value: CellValue, field: FieldDefinition): string => {
  switch (field.kind) {
    case 'code': return normalizeCode(value)
    case 'document': return normalizeAlphanumericDocument(value)
    case 'ie': return normalizeIE(value)
    case 'phone': return normalizePhone(value)
    case 'date': return normalizeDate(value)
    case 'money': return normalizeMoney(value)
    case 'personType': return normalizePersonType(value)
    case 'boolean': return normalizeBoolean(value)
    case 'sex': return normalizeSex(value)
    case 'state': return normalizeState(value)
    default: return normalizeText(value)
  }
}

export const hasReplacementCharacter = (value: CellValue) => asText(value).includes('�')

export const isInactiveValue = (header: string, value: CellValue): boolean => {
  const h = normalizeHeader(header)
  const v = normalizeText(value)
  if (!v) return false
  if (h.includes('INATIVO')) return ['S','SIM','1','TRUE','INATIVO'].includes(v)
  if (h.includes('ATIVO')) return ['N','NAO','NÃO','0','FALSE','INATIVO'].includes(v)
  return ['INATIVO','I','CANCELADO','BLOQUEADO'].includes(v)
}

export interface DocumentValidation {
  type: 'CPF' | 'CNPJ' | 'CNPJ_ALFANUMERICO' | 'DESCONHECIDO'
  status: 'VÁLIDO' | 'INVÁLIDO' | 'AUSENTE'
  detail: string
  normalized: string
}

export const isCpfValid = (value: CellValue): boolean => {
  const s = onlyDigits(value)
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false
  const n = [...s].map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += n[i] * (10 - i)
  let d = (sum * 10) % 11
  if (d === 10) d = 0
  if (d !== n[9]) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += n[i] * (11 - i)
  d = (sum * 10) % 11
  if (d === 10) d = 0
  return d === n[10]
}

const cnpjCharValue = (char: string) => char.charCodeAt(0) - 48

export const isCnpjValid = (value: CellValue): boolean => {
  const s = normalizeAlphanumericDocument(value)
  if (s.length !== 14) return false
  if (!/^[A-Z0-9]{12}\d{2}$/.test(s)) return false
  if (/^(\d)\1{13}$/.test(s)) return false

  const base = [...s.slice(0, 12)].map(cnpjCharValue)
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  let remainder = base.reduce((acc, current, i) => acc + current * w1[i], 0) % 11
  const d1 = remainder < 2 ? 0 : 11 - remainder
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  remainder = [...base, d1].reduce((acc, current, i) => acc + current * w2[i], 0) % 11
  const d2 = remainder < 2 ? 0 : 11 - remainder
  return Number(s[12]) === d1 && Number(s[13]) === d2
}

export const validateCpfCnpj = (value: CellValue): DocumentValidation => {
  const normalized = normalizeAlphanumericDocument(value)
  if (!normalized) return { type: 'DESCONHECIDO', status: 'AUSENTE', detail: 'Documento não informado na origem.', normalized }
  if (/^\d{11}$/.test(normalized)) {
    return isCpfValid(normalized)
      ? { type: 'CPF', status: 'VÁLIDO', detail: 'CPF válido pelos dígitos verificadores.', normalized }
      : { type: 'CPF', status: 'INVÁLIDO', detail: 'CPF inválido pelos dígitos verificadores.', normalized }
  }
  if (/^[A-Z0-9]{12}\d{2}$/.test(normalized)) {
    const alpha = /[A-Z]/.test(normalized.slice(0, 12))
    return isCnpjValid(normalized)
      ? { type: alpha ? 'CNPJ_ALFANUMERICO' : 'CNPJ', status: 'VÁLIDO', detail: alpha ? 'CNPJ alfanumérico válido pelo módulo 11.' : 'CNPJ válido pelos dígitos verificadores.', normalized }
      : { type: alpha ? 'CNPJ_ALFANUMERICO' : 'CNPJ', status: 'INVÁLIDO', detail: 'CNPJ inválido pelo cálculo dos dígitos verificadores.', normalized }
  }
  return { type: 'DESCONHECIDO', status: 'INVÁLIDO', detail: `Documento com formato inválido (${normalized.length} posições).`, normalized }
}
