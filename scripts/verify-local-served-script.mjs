import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const updaterRunner = readFileSync(new URL('./atualizar-validar-local-runner.cmd', import.meta.url), 'utf8')
const verifier = readFileSync(new URL('./verify-local-served-build.mjs', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

assert.match(updaterRunner, /git reset --hard origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /marcoantunes171989\/PrimeCheck/)
assert.match(updaterRunner, /\[7\/8\] Confirmando tela Consulta de produtos/)

assert.equal(packageJson.scripts['serve:local'], 'vite --strictPort')

assert.match(validator, /VITE_PRIMECHECK_SHA/)
assert.match(validator, /:4173/)
assert.match(validator, /taskkill \/PID %%P \/F/)
assert.match(validator, /npm run serve:local -- --host 127\.0\.0\.1 --port 4173 --open/)
assert.match(validator, /mantenha esta janela CMD aberta durante a validacao/)
assert.match(validator, /para encerrar o servidor, pressione Ctrl\+C/)
assert.doesNotMatch(validator, /start-local-server\.mjs/)
assert.doesNotMatch(validator, /vite-local-daemon\.mjs/)
assert.doesNotMatch(validator, /LOCAL_PORT/)
assert.doesNotMatch(validator, /detached/)
assert.doesNotMatch(validator, /VITE_PID/)
assert.doesNotMatch(validator, /VITE_LOG/)

assert.match(verifier, /Pesquisa por produtos/)
assert.match(verifier, /Consulta de produtos/)
assert.match(verifier, /expectedSha\.slice\(0, 12\)/)

assert.match(main, /PrimeCheckRuntimeBoundary/)
assert.match(main, /data-primecheck-runtime-error/)
assert.match(index, /primecheck-local-cleanup/)

assert.match(updater, /RUNNER_TEMP/)
assert.match(updater, /copy \/Y "%RUNNER_SOURCE%" "%RUNNER_TEMP%"/)
assert.match(updater, /call "%RUNNER_TEMP%" "%PROJECT_DIR%"/)
assert.doesNotMatch(updater, /git fetch|git reset|git switch|git checkout/)
assert.match(updaterRunner, /git checkout -B homologacao-local-validacao origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /git reset --hard origin\/homologacao-local-validacao/)
assert.doesNotMatch(updaterRunner, /git switch -c/)
assert.doesNotMatch(updaterRunner, /git show-ref --verify/)

assert.match(vite, /Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'/)

console.log('PrimeCheck foreground local validation flow verification: OK')
