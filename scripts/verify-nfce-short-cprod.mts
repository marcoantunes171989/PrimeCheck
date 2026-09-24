import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeShortCProd } from '../src/lib/nfce'

assert.equal(normalizeShortCProd('1'), '1')
assert.equal(normalizeShortCProd('1234567'), '1234567')
assert.equal(normalizeShortCProd('0000123'), '0000123')
assert.equal(normalizeShortCProd(' 7654321 '), '7654321')
assert.equal(normalizeShortCProd('12345678'), '')
assert.equal(normalizeShortCProd('ABC123'), '')
assert.equal(normalizeShortCProd('123-45'), '')
assert.equal(normalizeShortCProd(''), '')

const page = readFileSync(new URL('../src/pages/NfceAnalyticsPage.tsx', import.meta.url), 'utf8')
const start = page.indexOf('const shortProductCodeRows = useMemo<ProductCodeRow[]>')
const end = page.indexOf('const monthDocuments = useMemo', start)
assert.ok(start >= 0 && end > start, 'Bloco de códigos cProd curtos não localizado')

const shortCodeBlock = page.slice(start, end)
assert.match(shortCodeBlock, /normalizeShortCProd\(item\.code\)/)
assert.doesNotMatch(shortCodeBlock, /item\.ean/)
assert.doesNotMatch(shortCodeBlock, /item\.eanTrib/)
assert.match(shortCodeBlock, /fileName:\s*summary\.fileName/)
assert.match(shortCodeBlock, /nfceNumber:\s*summary\.number/)
assert.match(page, /Código do produto \(<cProd>\)/)
assert.match(page, /Arquivo XML de origem/)
assert.match(page, /Códigos de produto menores que 8 dígitos/)

console.log('NFC-e short cProd source traceability verification: OK')
