import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const isAncestor = (ancestor, descendant) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const localSha = git('rev-parse', 'HEAD')
const remoteSha = git('rev-parse', 'origin/homologacao-local-validacao')
const mainSha = git('rev-parse', 'origin/main')
const productionSha = git('rev-parse', 'origin/production-release')
const pendingProduction = Number(git('rev-list', '--count', 'origin/production-release..HEAD'))
const pendingMain = Number(git('rev-list', '--count', 'origin/main..HEAD'))
const buildInfo = JSON.parse(readFileSync(resolve('dist/build-info.json'), 'utf8'))
const authSource = readFileSync(resolve('src/components/PrimeCheckAuthGate.tsx'), 'utf8')
const mainSource = readFileSync(resolve('src/main.tsx'), 'utf8')
const dirty = git('status', '--porcelain')

assert.equal(localSha, remoteSha, 'Pasta local diferente da homologacao remota.')
assert.equal(buildInfo.sha, localSha, 'Build servido nao corresponde ao SHA local.')
assert.ok(isAncestor('origin/production-release', 'origin/main'), 'Main nao descende da producao conhecida.')
assert.ok(isAncestor('origin/main', 'HEAD'), 'Homologacao nao contem integralmente a main.')
assert.equal(dirty, '', 'Arquivos rastreados ou nao rastreados diferentes do repositorio foram encontrados.')
assert.match(mainSource, /<PrimeCheckAuthGate>[\s\S]*?<App \/>[\s\S]*?<\/PrimeCheckAuthGate>/)
assert.match(authSource, /const CURRENT_BUILD_SHA/)
assert.match(authSource, /parsed\.buildSha === CURRENT_BUILD_SHA/)
assert.match(authSource, /buildSha: CURRENT_BUILD_SHA/)

const state = {
  status: 'synchronized',
  productionSha,
  mainSha,
  homologationSha: remoteSha,
  localSha,
  buildSha: buildInfo.sha,
  pendingProduction,
  pendingMain,
  checkedAt: new Date().toISOString(),
}

writeFileSync(resolve('dist/version-state.json'), JSON.stringify(state, null, 2) + '\n', 'utf8')

console.log('')
console.log('PrimeCheck - trava de versao OK')
console.log(`  Producao : ${productionSha}`)
console.log(`  Main     : ${mainSha}`)
console.log(`  Local    : ${localSha}`)
console.log(`  Build    : ${buildInfo.sha}`)
console.log(`  Pendentes para producao: ${pendingProduction}`)
console.log(`  Pendentes para main    : ${pendingMain}`)
