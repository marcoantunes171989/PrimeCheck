import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { CHECKLIST_FIELDS, RECORD_STATUS_ALIASES } from '../config/checklist'
import type { DataRow, Dataset, ImportedFile } from '../types'
import { normalizeHeader, repairEncoding } from './normalizers'

const ACCEPTED = ['csv','txt','tsv','xls','xlsx','xlsm','xlsb','ods','fods']
const DELIMITERS = [';', ',', '\t', '|']

const HEADER_TOKENS = new Set(
  [
    ...CHECKLIST_FIELDS.flatMap(field => [field.label, ...field.aliases]),
    ...RECORD_STATUS_ALIASES,
  ].map(normalizeHeader),
)

const cleanRows = (rows: DataRow[]) =>
  rows.filter(row => Object.values(row).some(v => String(v ?? '').trim() !== ''))

const collectHeaders = (rows: DataRow[]) => {
  const set = new Set<string>()
  rows.forEach(row => Object.keys(row).forEach(k => set.add(String(k).trim())))
  return [...set].filter(Boolean)
}

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

const sanitizeText = (value: unknown) =>
  repairEncoding(String(value ?? ''))
    .replace(/^\uFEFF/, '')
    .replace(/^ï»¿/, '')
    .trim()

const decodeText = (buffer: ArrayBuffer) => {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const badUtf = (utf.match(/�/g) || []).length
  const cleanedUtf = utf.replace(/^\uFEFF/, '').replace(/^ï»¿/, '')

  if (badUtf === 0) return repairEncoding(cleanedUtf)

  try {
    const win = new TextDecoder('windows-1252').decode(buffer)
    const badWin = (win.match(/�/g) || []).length
    return repairEncoding(
      (badWin < badUtf ? win : utf)
        .replace(/^\uFEFF/, '')
        .replace(/^ï»¿/, ''),
    )
  } catch {
    return repairEncoding(cleanedUtf)
  }
}

type Matrix = string[][]

const normalizeMatrix = (rows: unknown[][]): Matrix =>
  rows
    .map(row => row.map(sanitizeText))
    .filter(row => row.some(cell => cell !== ''))

const aliasMatches = (row: string[]) =>
  row.reduce((count, cell) => {
    const normalized = normalizeHeader(cell)
    return count + (normalized && HEADER_TOKENS.has(normalized) ? 1 : 0)
  }, 0)

const findHeaderRow = (matrix: Matrix) => {
  const sample = matrix.slice(0, 60)
  if (!sample.length) return { index: 0, score: 0, width: 0, aliases: 0 }

  const maxWidth = Math.max(...sample.map(row => row.filter(Boolean).length), 0)
  const threshold = Math.max(2, Math.ceil(maxWidth * 0.6))

  let best = { index: 0, score: -Infinity, width: 0, aliases: 0 }

  sample.forEach((row, index) => {
    const width = row.filter(Boolean).length
    if (width < threshold) return

    const aliases = aliasMatches(row)
    const textLike = row.filter(cell => cell && /[A-Za-zÀ-ÿ_]/.test(cell)).length
    const uniqueness = new Set(row.filter(Boolean).map(normalizeHeader)).size

    const score =
      aliases * 10000 +
      width * 100 +
      textLike * 4 +
      uniqueness -
      index * 0.25

    if (score > best.score) best = { index, score, width, aliases }
  })

  return best
}

const uniqueHeaders = (rawHeaders: string[], width: number) => {
  const used = new Map<string, number>()
  const headers: string[] = []

  for (let index = 0; index < width; index++) {
    const source = sanitizeText(rawHeaders[index])
    const base = source || `COLUNA_${index + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    headers.push(count === 0 ? base : `${base}__${count + 1}`)
  }

  return headers
}

const matrixToRows = (matrix: Matrix, headerIndex: number): DataRow[] => {
  if (!matrix.length || headerIndex >= matrix.length) return []

  const dataMatrix = matrix.slice(headerIndex + 1).filter(row => row.some(Boolean))
  const width = Math.max(
    matrix[headerIndex]?.length ?? 0,
    ...dataMatrix.map(row => row.length),
  )

  const headers = uniqueHeaders(matrix[headerIndex] ?? [], width)

  return cleanRows(
    dataMatrix.map(row => {
      const record: DataRow = {}
      headers.forEach((header, index) => {
        record[header] = sanitizeText(row[index])
      })
      return record
    }),
  )
}

const parseDelimitedMatrix = (text: string, delimiter: string) => {
  const result = Papa.parse<string[]>(text, {
    header: false,
    delimiter,
    skipEmptyLines: 'greedy',
  })

  return {
    matrix: normalizeMatrix(result.data as unknown[][]),
    errors: result.errors,
  }
}

const detectDelimitedLayout = (text: string) => {
  const candidates = DELIMITERS.map(delimiter => {
    const parsed = parseDelimitedMatrix(text, delimiter)
    const header = findHeaderRow(parsed.matrix)

    const sampleAfterHeader = parsed.matrix.slice(header.index + 1, header.index + 31)
    const consistentRows = sampleAfterHeader.filter(row => {
      const width = row.filter(Boolean).length
      return header.width > 0 && width >= Math.max(2, Math.floor(header.width * 0.7))
    }).length

    const score =
      header.aliases * 100000 +
      header.width * 1000 +
      consistentRows * 25 -
      parsed.errors.length * 5

    return { delimiter, ...parsed, header, score }
  })

  return candidates.sort((a, b) => b.score - a.score)[0]
}

const parseDelimited = (file: File, buffer: ArrayBuffer): ImportedFile[] => {
  const text = decodeText(buffer)
  const detected = detectDelimitedLayout(text)

  if (!detected || !detected.matrix.length) {
    throw new Error('Não foi possível interpretar o arquivo delimitado.')
  }

  const rows = matrixToRows(detected.matrix, detected.header.index)
  if (!rows.length) {
    const firstError = detected.errors[0]?.message
    throw new Error(firstError || 'Nenhum registro foi encontrado após identificar o cabeçalho.')
  }

  return [{
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    extension: extensionOf(file.name),
    rows,
    headers: collectHeaders(rows),
  }]
}

const parseWorkbook = (file: File, buffer: ArrayBuffer): ImportedFile[] => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const parsed: ImportedFile[] = []

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })

    const matrix = normalizeMatrix(rawMatrix)
    if (!matrix.length) return

    const header = findHeaderRow(matrix)
    const rows = matrixToRows(matrix, header.index)
    if (!rows.length) return

    parsed.push({
      id: crypto.randomUUID(),
      name: file.name,
      sheetName,
      size: file.size,
      extension: extensionOf(file.name),
      rows,
      headers: collectHeaders(rows),
    })
  })

  if (!parsed.length) {
    throw new Error('Nenhuma planilha com registros foi encontrada no arquivo.')
  }

  return parsed
}

export const parseFile = async (file: File): Promise<ImportedFile[]> => {
  const ext = extensionOf(file.name)
  if (!ACCEPTED.includes(ext)) throw new Error(`Formato .${ext || '?'} não suportado.`)

  const buffer = await file.arrayBuffer()
  if (['csv','txt','tsv'].includes(ext)) return parseDelimited(file, buffer)
  return parseWorkbook(file, buffer)
}

export const parseFiles = async (
  files: File[],
): Promise<{ parsed: ImportedFile[]; errors: string[] }> => {
  const parsed: ImportedFile[] = []
  const errors: string[] = []

  for (const file of files) {
    try {
      parsed.push(...await parseFile(file))
    } catch (error) {
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      )
    }
  }

  return { parsed, errors }
}

export const buildDataset = (files: ImportedFile[]): Dataset => {
  const rows = files.flatMap(file =>
    file.rows.map(row => ({
      ...row,
      __primecheck_file: file.name,
      __primecheck_sheet: file.sheetName ?? '',
    })),
  )

  const headers = [...new Set(files.flatMap(file => file.headers))]
  return { files, rows, headers }
}

export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
