import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const updaterRunner = readFileSync(new URL('./atualizar-validar-local-runner.cmd', import.meta.url), 'utf8')
const syncVerifier = readFileSync(new URL('./verify-local-sync.mjs', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.equal(
  packageJson.scripts['preview:local'],
  'vite preview --host 127.0.0.1 --port 4177 --strictPort',
)

assert.match(validator, /\[1\/4\] Sincronizando dependencias/)
assert.match(validator, /\[2\/4\] Limpando artefatos e caches gerados/)
assert.match(validator, /\[3\/4\] Gerando e auditando o build local/)
assert.match(validator, /\[4\/4\] Iniciando Vite Preview na versao auditada/)
assert.match(validator, /node scripts\\verify-local-sync\.mjs/)
assert.match(validator, /VITE_PRIMECHECK_PRODUCTION_SHA/)
assert.match(validator, /VITE_PRIMECHECK_PENDING_COMMITS/)
assert.match(validator, /call npm run build/)
assert.match(validator, /call npm run preview:local/)
assert.match(validator, /http:\/\/127\.0\.0\.1:4177\//)
assert.doesNotMatch(validator, /powershell|primecheck-local\.ps1|start-local-server|vite-local-daemon|LOCAL_PORT|VITE_PID/)

assert.match(updater, /RUNNER_TEMP/)
assert.match(updater, /copy \/Y "%RUNNER_SOURCE%" "%RUNNER_TEMP%"/)
assert.match(updater, /call "%RUNNER_TEMP%" "%PROJECT_DIR%"/)

assert.match(updaterRunner, /git fetch origin --prune/)
assert.match(updaterRunner, /origin\/production-release/)
assert.match(updaterRunner, /git checkout -B homologacao-local-validacao origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /git reset --hard origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /git merge-base --is-ancestor origin\/production-release origin\/main/)
assert.match(updaterRunner, /git merge-base --is-ancestor origin\/main origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /primecheck-sync-state\.txt/)
assert.match(updaterRunner, /CURRENT_BUILD_SHA/)
assert.match(updaterRunner, /call "%PROJECT_DIR%validar-local\.cmd"/)

assert.match(syncVerifier, /buildInfo\.sha, localSha/)
assert.match(syncVerifier, /origin\/production-release/)
assert.match(syncVerifier, /origin\/main/)
assert.match(syncVerifier, /origin\/homologacao-local-validacao/)
assert.match(syncVerifier, /version-state\.json/)
assert.match(syncVerifier, /status: 'synchronized'/)

console.log('PrimeCheck version-locked local Vite Preview flow verification: OK')
