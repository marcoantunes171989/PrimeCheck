import { useMemo, useState } from 'react'
import clientSql from '../sql/cliente-destino-intersolid.sql?raw'
import supplierSql from '../sql/fornecedor-destino-intersolid.sql?raw'
import groupSql from '../sql/grupo-destino-intersolid.sql?raw'
import subgroupSql from '../sql/subgrupo-destino-intersolid.sql?raw'
import sectionSql from '../sql/secao-destino-intersolid.sql?raw'
import carrierSql from '../sql/transportadora-destino-intersolid.sql?raw'
import productStoreSql from '../sql/produto-loja-destino-intersolid.sql?raw'
import productSql from '../sql/produto-destino-intersolid.sql?raw'
import barcodeSql from '../sql/codigo-barras-destino-intersolid.sql?raw'
import similarSql from '../sql/produto-similar-destino-intersolid.sql?raw'
import productSupplierSql from '../sql/produto-fornecedor-destino-intersolid.sql?raw'
import ncmSql from '../sql/ncm-destino-intersolid.sql?raw'
import cestSql from '../sql/cest-destino-intersolid.sql?raw'
import ibptSql from '../sql/ibpt-destino-intersolid.sql?raw'
import ibsCbsSql from '../sql/ibs-cbs-destino-intersolid.sql?raw'
import fiscalBenefitSql from '../sql/beneficio-fiscal-destino-intersolid.sql?raw'
import recipeSql from '../sql/receita-destino-intersolid.sql?raw'
import nutritionSql from '../sql/informacao-nutricional-destino-intersolid.sql?raw'

type ScriptItem = {
  id: string
  group: string
  label: string
  file?: string
  sql?: string
}

const SCRIPTS: ScriptItem[] = [
  { id: 'clients', group: 'Parceiros', label: 'Clientes', file: 'cliente-destino-intersolid.sql', sql: clientSql },
  { id: 'suppliers', group: 'Parceiros', label: 'Fornecedores', file: 'fornecedor-destino-intersolid.sql', sql: supplierSql },
  { id: 'carriers', group: 'Parceiros', label: 'Transportadoras', file: 'transportadora-destino-intersolid.sql', sql: carrierSql },
  { id: 'sections', group: 'Classificação Mercadológica', label: 'Seções', file: 'secao-destino-intersolid.sql', sql: sectionSql },
  { id: 'groups', group: 'Classificação Mercadológica', label: 'Grupos', file: 'grupo-destino-intersolid.sql', sql: groupSql },
  { id: 'subgroups', group: 'Classificação Mercadológica', label: 'Subgrupos', file: 'subgrupo-destino-intersolid.sql', sql: subgroupSql },
  { id: 'product_store', group: 'Produtos', label: 'Produto por Loja', file: 'produto-loja-destino-intersolid.sql', sql: productStoreSql },
  { id: 'products', group: 'Produtos', label: 'Cadastro Base do Produto', file: 'produto-destino-intersolid.sql', sql: productSql },
  { id: 'barcodes', group: 'Produtos', label: 'Códigos de Barras', file: 'codigo-barras-destino-intersolid.sql', sql: barcodeSql },
  { id: 'similar_products', group: 'Produtos', label: 'Produtos Similares', file: 'produto-similar-destino-intersolid.sql', sql: similarSql },
  { id: 'product_suppliers', group: 'Produtos', label: 'Produto por Fornecedor', file: 'produto-fornecedor-destino-intersolid.sql', sql: productSupplierSql },
  { id: 'ncm', group: 'Fiscal e Conteúdo', label: 'NCM', file: 'ncm-destino-intersolid.sql', sql: ncmSql },
  { id: 'cest', group: 'Fiscal e Conteúdo', label: 'CEST', file: 'cest-destino-intersolid.sql', sql: cestSql },
  { id: 'ibpt', group: 'Fiscal e Conteúdo', label: 'IBPT', file: 'ibpt-destino-intersolid.sql', sql: ibptSql },
  { id: 'ibs_cbs', group: 'Fiscal e Conteúdo', label: 'IBS/CBS', file: 'ibs-cbs-destino-intersolid.sql', sql: ibsCbsSql },
  { id: 'fiscal_benefit', group: 'Fiscal e Conteúdo', label: 'Benefício Fiscal', file: 'beneficio-fiscal-destino-intersolid.sql', sql: fiscalBenefitSql },
  { id: 'recipes', group: 'Fiscal e Conteúdo', label: 'Receitas', file: 'receita-destino-intersolid.sql', sql: recipeSql },
  { id: 'nutrition', group: 'Fiscal e Conteúdo', label: 'Informações Nutricionais', file: 'informacao-nutricional-destino-intersolid.sql', sql: nutritionSql },
]

const GROUPS = ['Parceiros', 'Classificação Mercadológica', 'Produtos', 'Fiscal e Conteúdo']

export default function DestinationScriptsPage() {
  const available = SCRIPTS.filter(item => item.sql)
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? '')
  const [copied, setCopied] = useState(false)
  const selected = useMemo(() => SCRIPTS.find(item => item.id === selectedId), [selectedId])

  const copySql = async () => {
    if (!selected?.sql) return
    try {
      await navigator.clipboard.writeText(selected.sql)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selected.sql
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const downloadSql = () => {
    if (!selected?.sql || !selected.file) return
    const blob = new Blob([selected.sql], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = selected.file
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="destination-scripts-page">
      <header className="destination-scripts-head">
        <div>
          <span className="eyebrow">EXPORTAÇÃO DO DESTINO</span>
          <h1>Scripts SQL</h1>
          <p>Central de consultas do banco de destino para gerar os CSVs utilizados na homologação do PrimeCheck.</p>
        </div>
        <span className="destination-scripts-counter">{available.length} scripts disponíveis</span>
      </header>

      <div className="destination-scripts-layout">
        <aside className="destination-scripts-catalog" aria-label="Scripts SQL por módulo">
          {GROUPS.map(group => (
            <section key={group}>
              <h2>{group}</h2>
              {SCRIPTS.filter(item => item.group === group).map(item => {
                const enabled = Boolean(item.sql)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={'destination-script-item ' + (selectedId === item.id ? 'active ' : '') + (!enabled ? 'disabled' : '')}
                    onClick={() => enabled && setSelectedId(item.id)}
                    disabled={!enabled}
                    title={enabled ? 'Abrir script SQL' : 'Script ainda não cadastrado no projeto'}
                  >
                    <span>{item.label}</span>
                    <small>{enabled ? 'Disponível' : 'Não cadastrado'}</small>
                  </button>
                )
              })}
            </section>
          ))}
        </aside>

        <section className="destination-script-viewer">
          {selected?.sql ? (
            <>
              <header>
                <div>
                  <span className="eyebrow">{selected.group}</span>
                  <h2>{selected.label}</h2>
                  <p>Execute esta consulta no banco de destino e exporte o resultado em CSV para importação no PrimeCheck.</p>
                </div>
                <div className="destination-script-actions">
                  <button type="button" className="button secondary" onClick={copySql}>{copied ? 'Copiado!' : 'Copiar SQL'}</button>
                  <button type="button" className="button primary" onClick={downloadSql}>Baixar .sql</button>
                </div>
              </header>
              <div className="destination-script-file"><strong>Arquivo:</strong> {selected.file}</div>
              <pre className="client-sql-code destination-script-code"><code>{selected.sql}</code></pre>
            </>
          ) : (
            <div className="destination-script-empty">Nenhum script SQL cadastrado para este módulo.</div>
          )}
        </section>
      </div>
    </main>
  )
}
