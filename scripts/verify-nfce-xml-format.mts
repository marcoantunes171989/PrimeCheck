import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatXmlForDisplay } from '../src/lib/nfceXmlFormat'

const raw = '<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe123"><det nItem="1"><prod><cProd>451</cProd><cEAN>SEM GTIN</cEAN><xProd>HORT BATATA EXTRA KILO</xProd></prod></det></infNFe></NFe></nfeProc>'
const formatted = formatXmlForDisplay(raw)

assert.match(formatted, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<nfeProc versao="4\.00">/m)
assert.match(formatted, /\n  <NFe>\n    <infNFe Id="NFe123">/)
assert.match(formatted, /\n          <cProd>451<\/cProd>/)
assert.match(formatted, /\n          <xProd>HORT BATATA EXTRA KILO<\/xProd>/)
assert.match(formatted, /\n        <\/prod>\n      <\/det>/)
assert.equal(formatXmlForDisplay(''), '')
assert.equal(raw.includes('\n'), false, 'XML original de teste deve permanecer em uma única linha')

const page = readFileSync(new URL('../src/pages/NfceValidatorPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/nfce.css', import.meta.url), 'utf8')

assert.match(page, /formatXmlForDisplay\(selected\.rawXml\)/)
assert.match(page, /formattedRawXmlLines\.map/)
assert.match(page, /data-formatted-xml="true"/)
assert.match(page, /Formatado para leitura/)
assert.match(page, /copyPlainText\(selected\.rawXml\)/)
assert.match(page, /VISUALIZAÇÃO FORMATADA/)
assert.match(page, /nfce-modal-body-xml/)
assert.match(css, /\.nfce-raw-view \{[\s\S]*?display:\s*flex;[\s\S]*?height:\s*100%;/)
assert.match(css, /\.nfce-raw-code \{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*auto;/)
assert.match(css, /\.nfce-raw-line \{[\s\S]*?grid-template-columns:\s*52px minmax\(0, 1fr\)/)
assert.match(css, /overflow-wrap:\s*anywhere;/)
assert.match(css, /\.nfce-raw-line-number/)
assert.match(css, /\.nfce-modal-body\.nfce-modal-body-xml \{[\s\S]*?display:\s*flex;[\s\S]*?overflow:\s*hidden;/)

console.log('NFC-e formatted raw XML view verification: OK')
