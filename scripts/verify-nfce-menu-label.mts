import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sidebar = readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.match(sidebar, /\{ id: 'nfce:barcodes', label: 'Consulta produto' \}/)
assert.doesNotMatch(sidebar, /Códigos < 8 dígitos/)
assert.match(app, /\? 'NFC-e · Consulta produto'/)
assert.doesNotMatch(app, /NFC-e · Códigos curtos/)
assert.match(updater, /Confirmando menu NFC-e "Consulta produto"/)
assert.match(updater, /findstr \/C:"label: 'Consulta produto'"/)
assert.match(validator, /findstr ":4173"/)
assert.match(validator, /taskkill \/PID %%P \/F/)
assert.equal(packageJson.scripts['preview:lan'], 'vite preview --host 0.0.0.0 --port 4173 --strictPort')

console.log('NFC-e menu label and local preview freshness verification: OK')
