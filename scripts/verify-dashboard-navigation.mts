import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WORKSPACE_GROUPS } from '../src/config/workspaceModules'

const sidebar = readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/GeneralDashboardPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dashboardCss = readFileSync(new URL('../src/generalDashboard.css', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

assert.deepEqual(
  WORKSPACE_GROUPS.map(group => group.id),
  ['partners', 'structure', 'products', 'fiscal'],
)

assert.match(sidebar, /const DASHBOARD_GROUP_META/)
assert.match(sidebar, /partners: \{ label: 'Parceiros'/)
assert.match(sidebar, /structure: \{ label: 'Classificação Mercadológica'/)
assert.match(sidebar, /products: \{ label: 'Produtos'/)
assert.match(sidebar, /fiscal: \{ label: 'Fiscal e Conteúdo'/)
assert.match(sidebar, /const dashboardGroups = useMemo/)
assert.match(sidebar, /WORKSPACE_GROUPS\.map\(group =>/)
assert.match(sidebar, /dashboard-group:\$\{item\.group\.id\}/)
assert.match(sidebar, /dashboard:\$\{module\.id\}/)
assert.match(sidebar, /sidebar-dashboard-group/)
assert.match(sidebar, /sidebar-dashboard-child/)
assert.match(sidebar, /enabledCount/)
assert.doesNotMatch(sidebar, /\.filter\(module => module\.group === 'partners'\)/)

assert.match(dashboard, /onNavigate: \(target: string\) => void/)
assert.match(dashboard, /const navigationGroups = useMemo/)
assert.match(dashboard, /WORKSPACE_GROUPS\.map\(group =>/)
assert.match(dashboard, /Acesso rápido por área/)
assert.match(dashboard, /onNavigate\(\`dashboard:\$\{module\.id\}\`\)/)
assert.match(dashboard, /onNavigate\(\`data:\$\{module\.id\}\`\)/)
assert.match(dashboard, />\s*Dashboard\s*<\/button>/)
assert.match(dashboard, />\s*Dados\s*<\/button>/)
assert.match(dashboard, /onNavigate\('importacao'\)/)
assert.match(dashboard, /general-dashboard-entity-link/)
assert.match(dashboard, /target: 'nfce:overview'/)

assert.match(app, /<GeneralDashboardPage[\s\S]*?onNavigate=\{target => changeModule\(target as ModuleId\)\}/)

assert.match(dashboardCss, /\.general-dashboard-navigation-grid/)
assert.match(dashboardCss, /\.general-dashboard-navigation-actions/)
assert.match(dashboardCss, /\.general-dashboard-entity-link/)
assert.match(styles, /\.sidebar-dashboard-group/)
assert.match(styles, /\.sidebar-dashboard-child/)

console.log('Grouped dashboard navigation and direct module shortcuts: OK')
