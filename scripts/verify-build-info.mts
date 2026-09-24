import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const info = JSON.parse(readFileSync(resolve('dist/build-info.json'), 'utf8'))
const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

assert.equal(info.sha, gitSha)
assert.equal(info.shortSha, gitSha.slice(0, 12))

const assetFiles = readdirSync(resolve('dist/assets')).filter(name => name.endsWith('.js'))
assert.ok(assetFiles.length > 0, 'Bundle JavaScript não encontrado')

const bundle = assetFiles.map(name => readFileSync(resolve('dist/assets', name), 'utf8')).join('\n')

assert.match(bundle, /Pesquisa por produtos/)
assert.match(bundle, /Consulta de produtos/)
assert.match(bundle, /Menor que 8 dígitos/)
assert.match(bundle, /Maior que 8 dígitos/)
assert.match(bundle, /Processamento local/)
assert.match(bundle, /build-info\.json/)
assert.doesNotMatch(bundle, /Códigos < 8 dígitos/)
assert.doesNotMatch(bundle, /Códigos de produto menores que 8 dígitos/)

console.log('PrimeCheck build SHA and formatted XML bundle verification: OK')
