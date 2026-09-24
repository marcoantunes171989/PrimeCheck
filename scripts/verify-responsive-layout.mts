import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const responsive = readFileSync(new URL('../src/responsive.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

assert.match(main, /import '\.\/styles\.css'[\s\S]*import '\.\/responsive\.css'/)

for (const required of [
  'html,',
  'body,',
  '#root',
  'overflow-x: hidden',
  '.workspace-main',
  '.general-dashboard-page',
  '.workspace-import-page',
  '.module-comparison-page',
  '.nfce-page',
  '.nfce-analytics-page',
  '.internal-products-page',
  '.mapping-table-wrap',
  '.technical-diagnosis-table-wrap',
  '.records-table',
  '.issues-table',
  '.sidebar [id="sidebar-nav-group:structure"]',
  'white-space: nowrap !important',
  '@media (max-width: 1099px)',
  '@media (max-width: 720px)',
  '@media (max-width: 480px)',
]) {
  assert.ok(responsive.includes(required), 'Responsive contract missing: ' + required)
}

assert.match(responsive, /--pc-sidebar-width:\s*292px/)
assert.match(responsive, /workspace-shell:not\(\.sidebar-is-collapsed\) \.workspace-main[\s\S]*width:\s*calc\(100% - var\(--pc-sidebar-width\)\)/)
assert.match(responsive, /grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(180px, 100%\), 1fr\)\)/)
assert.match(responsive, /grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(420px, 100%\), 1fr\)\)/)
assert.match(responsive, /technical-diagnosis-table-wrap[\s\S]*overflow-x:\s*clip !important/)
assert.match(responsive, /workspace-import-progress-head small[\s\S]*white-space:\s*normal !important/)

console.log('Responsive UI contract verification: OK')
