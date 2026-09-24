import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const validator = readFileSync(new URL('../validar-local.cmd', import.meta.url), 'utf8')
const updater = readFileSync(new URL('../atualizar-validar-local.cmd', import.meta.url), 'utf8')
const updaterRunner = readFileSync(new URL('./atualizar-validar-local-runner.cmd', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.equal(
  packageJson.scripts['preview:local'],
  'vite preview --host 127.0.0.1 --port 4177 --strictPort',
)

assert.match(validator, /\[1\/3\] Instalando dependencias|\[1\/3\] Dependencias ja instaladas/)
assert.match(validator, /\[2\/3\] Gerando build local/)
assert.match(validator, /\[3\/3\] Iniciando Preview Vite local/)
assert.match(validator, /call npm run build/)
assert.match(validator, /call npm run preview:local/)
assert.match(validator, /http:\/\/127\.0\.0\.1:4177/)
assert.match(validator, /VITE_PRIMECHECK_SHA/)
assert.match(validator, /mantenha esta janela aberta durante a validacao/)
assert.doesNotMatch(validator, /powershell|primecheck-local\.ps1|start-local-server|vite-local-daemon|LOCAL_PORT|VITE_PID/)

assert.match(updater, /RUNNER_TEMP/)
assert.match(updater, /copy \/Y "%RUNNER_SOURCE%" "%RUNNER_TEMP%"/)
assert.match(updater, /call "%RUNNER_TEMP%" "%PROJECT_DIR%"/)
assert.match(updaterRunner, /git checkout -B homologacao-local-validacao origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /git reset --hard origin\/homologacao-local-validacao/)
assert.match(updaterRunner, /call "%PROJECT_DIR%validar-local\.cmd"/)

console.log('PrimeCheck simple local Vite Preview flow verification: OK')
