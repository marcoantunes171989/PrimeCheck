import { normalizeNfceSearch } from './nfce'

export type XmlSearchableEntry = {
  path: string
  name: string
  value: string
  attributes: string
}

const stripTagBrackets = (value: string) =>
  value
    .replace(/<\s*\/?\s*/g, '')
    .replace(/\s*\/?>/g, '')
    .trim()

const normalizePathQuery = (value: string) =>
  normalizeNfceSearch(stripTagBrackets(value))
    .replace(/\[(\d+)\]/g, '[$1]')
    .replace(/\s+/g, '')

export const xmlEntryMatchesSearch = (entry: XmlSearchableEntry, rawQuery: string) => {
  const raw = String(rawQuery ?? '').trim()
  if (!raw) return false

  const normalizedRaw = normalizeNfceSearch(raw)
  const cleaned = normalizeNfceSearch(stripTagBrackets(raw))
  if (!cleaned) return false

  const name = normalizeNfceSearch(entry.name)
  const value = normalizeNfceSearch(entry.value)
  const attributes = normalizeNfceSearch(entry.attributes)
  const path = normalizeNfceSearch(entry.path)

  const isExplicitPathSearch = raw.includes('/')
  if (isExplicitPathSearch) {
    const pathQuery = normalizePathQuery(raw)
    const normalizedPath = normalizePathQuery(entry.path)
    return Boolean(pathQuery && normalizedPath.includes(pathQuery))
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean)

  return tokens.every(token =>
    name.includes(token) ||
    value.includes(token) ||
    attributes.includes(token),
  ) || (
    normalizedRaw !== cleaned &&
    tokens.every(token =>
      name.includes(token) ||
      value.includes(token) ||
      attributes.includes(token),
    )
  )
}
