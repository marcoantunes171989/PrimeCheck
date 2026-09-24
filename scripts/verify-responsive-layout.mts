import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const responsive = readFileSync(new URL('../src/responsive.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

assert.match(main, /import '\.\/styles\.css'\s*\nimport '\.\/responsive\.css'/)

assert.match(responsive, /html,[\s\S]*?body[\s\S]*?overflow-x:\s*clip/)
assert.match(responsive, /\.workspace-main[\s\S]*?overflow-x:\s*clip/)
assert.match(responsive, /\[class\*="table-wrap"\][\s\S]*?overflow-x:\s*auto/)
assert.match(responsive, /scrollbar-gutter:\s*stable/)
assert.match(responsive, /@media \(max-width:\s*1450px\)/)
assert.match(responsive, /@media \(max-width:\s*1199px\)/)
assert.match(responsive, /@media \(max-width:\s*900px\)/)
assert.match(responsive, /@media \(max-width:\s*640px\)/)
assert.match(responsive, /@media \(max-width:\s*420px\)/)
assert.match(responsive, /sidebar-nav-group:structure/)
assert.match(responsive, /white-space:\s*nowrap\s*!important/)
assert.match(responsive, /\.workspace-main h1[\s\S]*?clamp\(24px, 2vw, 32px\)/)
assert.match(responsive, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
assert.match(responsive, /grid-template-columns:\s*1fr\s*!important/)

console.log('Global responsive layout verification: OK')
