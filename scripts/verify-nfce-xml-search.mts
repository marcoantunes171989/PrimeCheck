import assert from 'node:assert/strict'
import { xmlEntryMatchesSearch } from '../src/lib/nfceXmlSearch'

const cProd = {
  path: '/nfeProc/NFe/infNFe/det[1]/prod/cProd',
  name: 'cProd',
  value: '451',
  attributes: '',
}
const xProd = {
  path: '/nfeProc/NFe/infNFe/det[1]/prod/xProd',
  name: 'xProd',
  value: 'HORT BATATA EXTRA KILO',
  attributes: '',
}
const ncm = {
  path: '/nfeProc/NFe/infNFe/det[1]/prod/NCM',
  name: 'NCM',
  value: '07019000',
  attributes: '',
}
const det = {
  path: '/nfeProc/NFe/infNFe/det[11]',
  name: 'det',
  value: '',
  attributes: 'nItem="11"',
}

assert.equal(xmlEntryMatchesSearch(cProd, 'cProd'), true)
assert.equal(xmlEntryMatchesSearch(cProd, '<cProd>'), true)
assert.equal(xmlEntryMatchesSearch(cProd, '</cProd>'), true)
assert.equal(xmlEntryMatchesSearch(cProd, 'prod'), true)
assert.equal(xmlEntryMatchesSearch(xProd, 'prod'), true)
assert.equal(xmlEntryMatchesSearch(ncm, 'prod'), false, 'não deve casar apenas porque /prod/ existe no caminho')
assert.equal(xmlEntryMatchesSearch(cProd, '451'), true)
assert.equal(xmlEntryMatchesSearch(xProd, 'batata'), true)
assert.equal(xmlEntryMatchesSearch(det, 'nItem'), true)
assert.equal(xmlEntryMatchesSearch(det, '11'), true)
assert.equal(xmlEntryMatchesSearch(cProd, 'cProd 451'), true)
assert.equal(xmlEntryMatchesSearch(cProd, '/det[1]/prod/cProd'), true)
assert.equal(xmlEntryMatchesSearch(ncm, '/det[1]/prod/cProd'), false)

console.log('NFC-e XML tag/value unified search verification: OK')
