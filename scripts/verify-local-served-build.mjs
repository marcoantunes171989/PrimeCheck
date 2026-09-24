import assert from 'node:assert/strict'

const baseUrl = String(process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const expectedSha = String(process.argv[3] || '').trim()
assert.ok(expectedSha, 'SHA esperado não informado')

const stamp = Date.now()
const getText = async (url) => {
  const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
  assert.equal(response.ok, true, `Falha HTTP ${response.status} em ${url}`)
  return response.text()
}

const infoResponse = await fetch(`${baseUrl}/build-info.json?ts=${stamp}`, { cache: 'no-store' })
assert.equal(infoResponse.ok, true, 'build-info.json indisponível')
const info = await infoResponse.json()
assert.equal(info.sha, expectedSha, `SHA servido divergente: ${info.sha}`)

const html = await getText(`${baseUrl}/?build=${expectedSha}&ts=${stamp}`)
const assetMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/g)].map(match => match[1])
assert.ok(assetMatches.length > 0, 'Bundle JavaScript não localizado no HTML servido')

const bundleParts = []
for (const asset of assetMatches) {
  const assetUrl = asset.startsWith('http') ? asset : `${baseUrl}${asset.startsWith('/') ? '' : '/'}${asset}`
  bundleParts.push(await getText(`${assetUrl}?ts=${stamp}`))
}
const bundle = bundleParts.join('\n')

assert.match(bundle, /Pesquisa por produtos/)
assert.match(bundle, /Consulta de produtos/)
assert.match(bundle, /Menor que 8 dígitos/)
assert.match(bundle, /Maior que 8 dígitos/)
assert.match(bundle, /Número ou série da NFC-e/)
assert.match(bundle, /Data de emissão/)
assert.doesNotMatch(bundle, /Códigos < 8 dígitos/)
assert.doesNotMatch(bundle, /Códigos de produto menores que 8 dígitos/)
assert.doesNotMatch(bundle, /NFC-e · Códigos curtos/)

console.log(`PrimeCheck local served bundle OK: ${expectedSha.slice(0, 12)}`)
