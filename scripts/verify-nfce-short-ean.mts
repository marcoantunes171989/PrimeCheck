import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeShortCean } from '../src/lib/nfce'

assert.equal(normalizeShortCean('1'), '1')
assert.equal(normalizeShortCean('1234567'), '1234567')
assert.equal(normalizeShortCean('0000123'), '0000123')
assert.equal(normalizeShortCean(' 7654321 '), '7654321')
assert.equal(normalizeShortCean('12345678'), '')
assert.equal(normalizeShortCean('7891234567890'), '')
assert.equal(normalizeShortCean('SEM GTIN'), '')
assert.equal(normalizeShortCean('123-45'), '')
assert.equal(normalizeShortCean(''), '')

const page = readFileSync(new URL('../src/pages/NfceAnalyticsPage.tsx', import.meta.url), 'utf8')
const start = page.indexOf('const shortBarcodeRows = useMemo<BarcodeRow[]>')
const end = page.indexOf('const monthDocuments = useMemo', start)
assert.ok(start >= 0 && end > start, 'Bloco de códigos cEAN curtos não localizado')

const shortBarcodeBlock = page.slice(start, end)
assert.match(shortBarcodeBlock, /normalizeShortCean\(item\.ean\)/)
assert.doesNotMatch(shortBarcodeBlock, /eanTrib/)
assert.match(shortBarcodeBlock, /fileName:\s*summary\.fileName/)
assert.match(shortBarcodeBlock, /nfceNumber:\s*summary\.number/)
assert.match(page, /Código de barras \(<cEAN>\)/)
assert.match(page, /Arquivo XML de origem/)

console.log('NFC-e short cEAN source traceability verification: OK')
