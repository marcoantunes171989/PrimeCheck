import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const auth = readFileSync(new URL('../src/components/PrimeCheckAuthGate.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

assert.match(main, /import PrimeCheckAuthGate from '\.\/components\/PrimeCheckAuthGate'/)
assert.match(main, /<PrimeCheckAuthGate>[\s\S]*?<App \/>[\s\S]*?<\/PrimeCheckAuthGate>/)

const appOccurrences = main.match(/<App \/>/g) ?? []
assert.equal(appOccurrences.length, 1, 'App deve ser renderizado uma única vez, dentro do AuthGate')

assert.match(auth, /PRIME_CHECK_ADMIN_USERNAME = 'administrador'/)
assert.match(auth, /PRIME_CHECK_ADMIN_PASSWORD = 'admin@admin'/)
assert.match(auth, /primecheck\.auth\.session\.v1/)
assert.match(auth, /const CURRENT_BUILD_SHA/)
assert.match(auth, /VITE_PRIMECHECK_SHA/)
assert.match(auth, /VITE_VERCEL_GIT_COMMIT_SHA/)
assert.match(auth, /VITE_PRIMECHECK_PRODUCTION_SHA/)
assert.match(auth, /VITE_PRIMECHECK_PENDING_COMMITS/)
assert.match(auth, /data-primecheck-version-state="true"/)
assert.match(auth, /parsed\.buildSha === CURRENT_BUILD_SHA/)
assert.match(auth, /buildSha: CURRENT_BUILD_SHA/)
assert.match(auth, /window\.sessionStorage\.setItem\(AUTH_SESSION_KEY/)
assert.match(auth, /window\.sessionStorage\.removeItem\(AUTH_SESSION_KEY/)
assert.match(auth, /data-primecheck-auth="required"/)
assert.match(auth, /Acesse o projeto/)
assert.match(auth, /Solicitar novo cadastro/)
assert.match(auth, /Registrar solicitação/)
assert.match(auth, /primecheck\.auth\.requests\.v1/)
assert.match(auth, /window\.localStorage\.setItem/)
assert.match(auth, /status: 'pending'/)
assert.match(auth, /não libera o projeto automaticamente/)
assert.doesNotMatch(auth, /setAuthenticatedUser\(desiredUsername\)/)

assert.match(app, /usePrimeCheckAuth\(\)/)
assert.match(app, /productionBuildSha/)
assert.match(app, /pendingProductionCommits/)
assert.match(app, /data-primecheck-version-state="true"/)
assert.match(app, /className="workspace-logout-button"/)
assert.match(app, /onClick=\{logout\}/)
assert.match(app, />\s*Sair\s*<\/button>/)

const bundleFiles = readdirSync(resolve('dist/assets')).filter(name => name.endsWith('.js'))
assert.ok(bundleFiles.length > 0, 'Bundle JavaScript não encontrado')
const bundle = bundleFiles.map(name => readFileSync(resolve('dist/assets', name), 'utf8')).join('\n')

assert.match(bundle, /Acesse o projeto/)
assert.match(bundle, /Solicitar novo cadastro/)
assert.match(bundle, /Entrar no PrimeCheck/)
assert.match(bundle, /O workspace permanece bloqueado até uma autenticação válida/)
assert.match(bundle, /administrador/)
assert.match(bundle, /admin@admin/)

console.log('PrimeCheck authentication gate, fixed credentials and access request flow: OK')
