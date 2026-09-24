import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const sidebar = readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.match(sidebar, /\{ id: 'nfce:barcodes', label: 'Pesquisa por produtos' \}/)
assert.doesNotMatch(sidebar, /Códigos < 8 dígitos/)
assert.match(app, /\? 'NFC-e · Consulta de produtos'/)
assert.doesNotMatch(app, /NFC-e · Códigos curtos/)
assert.match(updater, /Confirmando menu NFC-e "Pesquisa por produtos"/)
assert.match(updater, /findstr \/C:"label: 'Pesquisa por produtos'"/)
assert.match(validator, /findstr ":4173"/)
assert.match(validator, /taskkill \/PID %%P \/F/)
assert.equal(packageJson.scripts['serve:local'], 'vite --host localhost --port 4173 --strictPort')
assert.match(main, /localValidation = \['localhost', '127\.0\.0\.1', '::1'\]/)
assert.match(main, /registration\.unregister\(\)/)
assert.match(main, /caches\.delete\(key\)/)
assert.match(updater, /\[1\/8\] Validando repositorio/)
assert.match(updater, /\[2\/8\] Abrindo/)
assert.match(updater, /\[3\/8\] Sincronizando exatamente/)
assert.match(updater, /\[5\/8\] Confirmando SHA local = remoto/)
assert.match(updater, /\[8\/8\] Iniciando validacao local/)
assert.match(validator, /\[1\/6\] Encerrando/)
assert.match(validator, /\[3\/6\] Limpando build/)
assert.match(validator, /\[6\/6\] Confirmando SHA, HTML e bundle realmente servidos/)
assert.match(updater, /git reset --hard origin\/homologacao-local-validacao/)
assert.match(updater, /marcoantunes171989\/PrimeCheck/)
assert.match(updater, /\[7\/8\] Confirmando tela Consulta de produtos/)
assert.match(validator, /http:\/\/localhost:4173/)
assert.match(validator, /verify-local-served-build\.mjs/)
assert.match(validator, /Microsoft\\\\Edge\\\\Application\\\\msedge\.exe/)
assert.match(validator, /--headless=new/)
assert.match(validator, /--dump-dom/)
assert.match(main, /PrimeCheckRuntimeBoundary/)
assert.match(main, /data-primecheck-runtime-error/)

console.log('NFC-e menu label and local preview freshness verification: OK')


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
