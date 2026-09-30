import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const updaterRunner = readFileSync(new URL('./atualizar-validar-local-runner.cmd', import.meta.url), 'utf8')
const syncVerifier = readFileSync(new URL('./verify-local-sync.mjs', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.equal(packageJson.scripts['preview:local'], 'vite preview --host 127.0.0.1 --port 4177 --strictPort')

assert.match(validator, /Sincronizando dependencias/)
assert.match(validator, /Limpando artefatos e caches gerados/)
assert.match(validator, /Gerando e auditando o build local/)
assert.match(validator, /Iniciando Vite Preview na versao auditada/)
assert.match(validator, /verify-local-sync\.mjs/)
assert.match(validator, /VITE_PRIMECHECK_PRODUCTION_SHA/)
assert.match(validator, /VITE_PRIMECHECK_PENDING_COMMITS/)
assert.match(validator, /npm run build/)
assert.match(validator, /npm run preview:local/)
assert.match(validator, /127\.0\.0\.1:4177/)

assert.match(updater, /RUNNER_TEMP/)
assert.match(updaterRunner, /git fetch origin --prune/)
assert.match(updaterRunner, /origin\/production-release/)
assert.match(updaterRunner, /origin\/main/)
assert.match(updaterRunner, /origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /primecheck-sync-state\.txt/)
assert.match(updaterRunner, /CURRENT_BUILD_SHA/)
assert.match(updaterRunner, /validar-local\.cmd/)

assert.match(syncVerifier, /buildInfo\.sha, localSha/)
assert.match(syncVerifier, /production-release/)
assert.match(syncVerifier, /version-state\.json/)
assert.match(syncVerifier, /status: 'synchronized'/)

console.log('PrimeCheck version-locked local Vite Preview flow verification: OK')
