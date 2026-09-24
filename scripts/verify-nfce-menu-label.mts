import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const sidebar = readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const updaterRunner = readFileSync(new URL('./atualizar-validar-local-runner.cmd', import.meta.url), 'utf8')
const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.match(sidebar, /\{ id: 'nfce:barcodes', label: 'Pesquisa por produtos' \}/)
assert.doesNotMatch(sidebar, /Códigos < 8 dígitos/)
assert.match(app, /\? 'NFC-e · Consulta de produtos'/)
assert.doesNotMatch(app, /NFC-e · Códigos curtos/)

assert.match(updaterRunner, /Confirmando menu NFC-e "Pesquisa por produtos"/)
assert.match(updaterRunner, /\[7\/8\] Confirmando tela Consulta de produtos/)
assert.match(updaterRunner, /git reset --hard origin\/homologacao-local-validacao/)

assert.equal(
  packageJson.scripts['preview:local'],
  'vite preview --host 127.0.0.1 --port 4177 --strictPort',
)
assert.match(validator, /call npm run preview:local/)
assert.match(validator, /http:\/\/127\.0\.0\.1:4177/)
assert.doesNotMatch(validator, /powershell|primecheck-local\.ps1/)

console.log('NFC-e menu label and simple local preview verification: OK')

const readDistText = (dir: string): string =>
  readdirSync(dir)
    .map(name => resolve(dir, name))
    .map(path => statSync(path).isDirectory() ? readDistText(path) : (/\.(?:js|html|css)$/.test(path) ? readFileSync(path, 'utf8') : ''))
    .join('\n')

const distText = readDistText(resolve('dist'))
assert.match(distText, /Pesquisa por produtos/)
assert.match(distText, /NFC-e · Consulta de produtos/)
assert.doesNotMatch(distText, /Códigos < 8 dígitos/)
assert.doesNotMatch(distText, /NFC-e · Códigos curtos/)

console.log('Built bundle contains the updated NFC-e menu label: OK')
