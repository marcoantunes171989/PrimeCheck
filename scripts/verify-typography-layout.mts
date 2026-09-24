import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/generalDashboard.css', import.meta.url), 'utf8')
const nfceAnalytics = readFileSync(new URL('../src/nfceAnalytics.css', import.meta.url), 'utf8')

assert.match(styles, /--fs-base:\s*15px/)
assert.match(styles, /--fs-3xl:\s*28px/)
assert.match(styles, /\[id="sidebar-nav-group:structure"\][\s\S]*?white-space:\s*nowrap/)
assert.match(styles, /\[id="sidebar-nav-group:structure"\][\s\S]*?font-size:\s*11\.5px/)
assert.match(styles, /grid-template-columns:\s*30px minmax\(0, 1fr\) 12px/)
assert.match(styles, /--fs-page-title:\s*clamp\(26px, 2\.2vw, 34px\)/)
assert.match(dashboard, /general-dashboard-hero h1[\s\S]*?font-size:\s*clamp\(26px, 2\.2vw, 34px\)/)
assert.match(nfceAnalytics, /nfce-analytics-hero h1[\s\S]*?font-size:\s*clamp\(26px, 2\.2vw, 34px\)/)

console.log('Typography and sidebar layout verification: OK')
