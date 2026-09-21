import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { DataRow, Dataset, ImportedFile } from '../types'

const ACCEPTED = ['csv','txt','tsv','xls','xlsx','xlsm','xlsb','ods','fods']

const cleanRows = (rows: DataRow[]) => rows.filter(row => Object.values(row).some(v => String(v ?? '').trim() !== ''))

const collectHeaders = (rows: DataRow[]) => {
  const set = new Set<string>()
  rows.forEach(row => Object.keys(row).forEach(k => set.add(String(k).trim())))
  return [...set].filter(Boolean)
}

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

const decodeText = (buffer: ArrayBuffer) => {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const badUtf = (utf.match(/�/g) || []).length
  if (badUtf === 0) return utf
  try {
    const win = new TextDecoder('windows-1252').decode(buffer)
    const badWin = (win.match(/�/g) || []).length
    return badWin < badUtf ? win : utf
  } catch {
    return utf
  }
}

const parseDelimited = (file: File, buffer: ArrayBuffer): ImportedFile[] => {
  const text = decodeText(buffer)
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: h => String(h ?? '').trim(),
    delimitersToGuess: [',',';','\t','|'],
  })
  if (result.errors.length && !result.data.length) {
    throw new Error(result.errors[0]?.message || 'Não foi possível interpretar o arquivo.')
  }
  const rows = cleanRows(result.data as DataRow[])
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
    const rows = cleanRows(XLSX.utils.sheet_to_json<DataRow>(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' }))
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
  if (!parsed.length) throw new Error('Nenhuma planilha com registros foi encontrada no arquivo.')
  return parsed
}

export const parseFile = async (file: File): Promise<ImportedFile[]> => {
  const ext = extensionOf(file.name)
  if (!ACCEPTED.includes(ext)) throw new Error(`Formato .${ext || '?'} não suportado.`)
  const buffer = await file.arrayBuffer()
  if (['csv','txt','tsv'].includes(ext)) return parseDelimited(file, buffer)
  return parseWorkbook(file, buffer)
}

export const parseFiles = async (files: File[]): Promise<{ parsed: ImportedFile[]; errors: string[] }> => {
  const parsed: ImportedFile[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      parsed.push(...await parseFile(file))
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
    }
  }
  return { parsed, errors }
}

export const buildDataset = (files: ImportedFile[]): Dataset => {
  const rows = files.flatMap(file => file.rows.map(row => ({ ...row, __primecheck_file: file.name, __primecheck_sheet: file.sheetName ?? '' })))
  const headers = [...new Set(files.flatMap(file => file.headers))]
  return { files, rows, headers }
}

export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
