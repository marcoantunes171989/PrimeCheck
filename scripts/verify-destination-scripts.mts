import fs from 'node:fs'

const app = fs.readFileSync('src/App.tsx', 'utf8')
const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8')
const page = fs.readFileSync('src/pages/DestinationScriptsPage.tsx', 'utf8')

const required = [
  [app.includes("DestinationScriptsPage"), 'App registra DestinationScriptsPage'],
  [app.includes("'scripts'"), 'App registra rota scripts'],
  [sidebar.includes("SCRIPTS"), 'Sidebar possui seção SCRIPTS'],
  [sidebar.includes("Scripts SQL do destino"), 'Sidebar possui acesso central'],
  [page.includes("cliente-destino-intersolid.sql?raw"), 'Central reutiliza SQL de Clientes'],
  [page.includes("fornecedor-destino-intersolid.sql?raw"), 'Central reutiliza SQL de Fornecedores'],
  [page.includes("grupo-destino-intersolid.sql?raw"), 'Central reutiliza SQL de Grupos'],
  [page.includes("subgrupo-destino-intersolid.sql?raw"), 'Central reutiliza SQL de Subgrupos'],
  [page.includes("Não cadastrado"), 'Módulos sem SQL são identificados sem inventar consulta'],
  [page.includes("Baixar .sql"), 'Central permite baixar SQL'],
  [page.includes("Copiar SQL"), 'Central permite copiar SQL'],
]

let failed = false
for (const [ok, label] of required) {
  console.log(ok ? 'PASS' : 'FAIL', '-', label)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS - central de scripts SQL validada')
