import fs from 'node:fs'

const files = [
  'src/HomologationApp.tsx',
  'src/components/ManagementDashboardView.tsx',
  'src/components/TechnicalDiagnosisView.tsx',
]
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  if (source.includes('window.print()')) throw new Error(`Impressão nativa ainda encontrada em ${file}`)
  if (!source.includes('exportPrimeCheckPdf')) throw new Error(`Gerador próprio não integrado em ${file}`)
}
const utility = fs.readFileSync('src/lib/pdfReport.ts', 'utf8')
for (const token of ['application/pdf', 'html-to-image', 'anchor.download']) {
  if (!utility.includes(token)) throw new Error(`Gerador PDF sem requisito: ${token}`)
}
console.log('PASS: relatórios auditados usam o gerador PDF próprio do PrimeCheck.')
