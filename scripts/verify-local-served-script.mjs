import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const verifier = readFileSync(new URL('./verify-local-served-build.mjs', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

assert.match(updater, /git reset --hard origin\/homologacao-local-validacao/)
assert.match(updater, /marcoantunes171989\/PrimeCheck/)
assert.match(updater, /\[7\/8\] Confirmando tela Consulta de produtos/)
assert.match(validator, /127\.0\.0\.1:4173/)
assert.doesNotMatch(validator, /start "" "http:\/\/localhost:4173/)
assert.match(validator, /verify-local-served-build\.mjs/)
assert.match(verifier, /Pesquisa por produtos/)
assert.match(verifier, /Consulta de produtos/)
assert.match(verifier, /doesNotMatch\(bundle, \/Códigos < 8 dígitos\//)
assert.match(vite, /Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'/)

console.log('PrimeCheck definitive local validation flow verification: OK')
