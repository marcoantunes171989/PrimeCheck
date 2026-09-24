import assert from 'node:assert/strict'

const baseUrl = String(process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const expectedSha = String(process.argv[3] || '').trim()
assert.ok(expectedSha, 'SHA esperado não informado')

const stamp = Date.now()
const getText = async (url) => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  assert.equal(response.ok, true, `Falha HTTP ${response.status} em ${url}`)
  return response.text()
}

const html = await getText(`${baseUrl}/?build=${expectedSha}&ts=${stamp}`)
assert.match(html, /\/src\/main\.tsx/)
assert.match(html, /primecheck-local-cleanup/)

const [main, app, sidebar, analytics] = await Promise.all([
  getText(`${baseUrl}/src/main.tsx?ts=${stamp}`),
  getText(`${baseUrl}/src/App.tsx?ts=${stamp}`),
  getText(`${baseUrl}/src/components/Sidebar.tsx?ts=${stamp}`),
  getText(`${baseUrl}/src/pages/NfceAnalyticsPage.tsx?ts=${stamp}`),
])

assert.match(main, /PrimeCheckRuntimeBoundary/)
assert.match(main, /data-primecheck-runtime-error/)
assert.match(main, /data-primecheck-runtime/)
assert.match(app, new RegExp(expectedSha.slice(0, 12)))
assert.match(app, /Processamento local/)
assert.match(sidebar, /Pesquisa por produtos/)
assert.doesNotMatch(sidebar, /Códigos < 8 dígitos/)
assert.match(analytics, /Consulta de produtos/)
assert.match(analytics, /Menor que 8 dígitos/)
assert.match(analytics, /Maior que 8 dígitos/)
assert.match(analytics, /Número ou série da NFC-e/)
assert.match(analytics, /Data de emissão/)
assert.doesNotMatch(analytics, /Códigos de produto menores que 8 dígitos/)

console.log(`PrimeCheck local Vite source OK: ${expectedSha.slice(0, 12)}`)
