import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/NfceValidatorPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/nfce.css', import.meta.url), 'utf8')

assert.match(page, /const StaticXmlNode = \(/)
assert.match(page, /children\.map\(\(child, index\) => \(/)
assert.match(page, /<StaticXmlNode[\s\S]*?element=\{child\}[\s\S]*?depth=\{depth \+ 1\}/)
assert.match(page, /children\.length > 0 && \([\s\S]*?nfce-static-xml-closing/)
assert.match(page, /ARQUIVO ORIGINAL · ESTRUTURA XML FIXA/)
assert.match(page, /Todos os níveis expandidos/)
assert.match(page, /data-static-xml="true"/)
assert.match(page, /xmlDeclaration/)
assert.match(page, /rootElement && <StaticXmlNode element=\{rootElement\}/)
assert.match(page, /copyPlainText\(selected\.rawXml\)/)
assert.doesNotMatch(page, /formattedRawXmlLines\.map/)
assert.doesNotMatch(page, /formatXmlForDisplay\(selected\.rawXml\)/)

assert.match(css, /\.nfce-static-xml-tree \{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*auto;/)
assert.match(css, /\.nfce-static-xml-row \{[\s\S]*?display:\s*flex;/)
assert.match(css, /\.nfce-static-xml-value \{[\s\S]*?overflow-wrap:\s*anywhere;/)
assert.match(css, /\.nfce-modal-body\.nfce-modal-body-xml \{[\s\S]*?overflow:\s*hidden;/)

console.log('NFC-e fixed fully expanded XML tree verification: OK')
