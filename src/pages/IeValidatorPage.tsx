import { useMemo, useState } from 'react'
import {
  formatInscricaoEstadual,
  validateInscricaoEstadual,
  type UfCode,
} from '@br-validators/core/inscricao-estadual'

const UFS: UfCode[] = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

export default function IeValidatorPage() {
  const [uf, setUf] = useState<UfCode>('SP')
  const [value, setValue] = useState('')

  const normalized = value.trim()
  const isento = /^isento$/i.test(normalized)

  const result = useMemo(() => {
    if (!normalized || isento) return null
    return validateInscricaoEstadual(normalized, { uf })
  }, [normalized, uf, isento])

  const formatted = useMemo(() => {
    if (!normalized || isento) return ''
    const response = formatInscricaoEstadual(normalized, { uf })
    return response.ok ? response.formatted : ''
  }, [normalized, uf, isento])

  return (
    <main className="module-page">
      <section className="module-hero">
        <span className="eyebrow">VALIDAÇÃO LOCAL</span>
        <h1>Validação de Inscrição Estadual</h1>
        <p>
          Validação por UF, com cálculo dos dígitos verificadores das 27 unidades federativas,
          executada integralmente no navegador.
        </p>
      </section>

      <section className="validator-card">
        <div className="validator-form ie-form">
          <label>
            <span>UF</span>
            <select value={uf} onChange={event => setUf(event.target.value as UfCode)}>
              {UFS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grow">
            <span>Inscrição Estadual</span>
            <input
              value={value}
              onChange={event => setValue(event.target.value)}
              placeholder="Digite ou cole a inscrição estadual"
            />
          </label>
          <button className="button ghost" type="button" onClick={() => setValue('')}>Limpar</button>
        </div>

        {!normalized && (
          <div className="validator-empty">
            Selecione a UF e informe a inscrição estadual.
          </div>
        )}

        {isento && (
          <div className="validator-result attention">
            <div className="validator-result-icon">i</div>
            <div>
              <span>ISENTO</span>
              <strong>Cadastro informado como isento</strong>
              <p>O valor “ISENTO” é aceito como situação cadastral especial, sem cálculo de dígito verificador.</p>
            </div>
          </div>
        )}

        {result && (
          <div className={`validator-result ${result.ok ? 'valid' : 'invalid'}`}>
            <div className="validator-result-icon">{result.ok ? '✓' : '!'}</div>
            <div>
              <span>{result.ok ? 'INSCRIÇÃO ESTADUAL VÁLIDA' : 'INSCRIÇÃO ESTADUAL INVÁLIDA'}</span>
              <strong>{formatted || normalized}</strong>
              <p>{result.ok ? `Validação concluída para a UF ${uf}.` : result.message}</p>
            </div>
          </div>
        )}

        <div className="validator-details">
          <div><span>UF selecionada</span><strong>{uf}</strong></div>
          <div><span>Valor informado</span><strong>{value || '—'}</strong></div>
          <div><span>Valor formatado</span><strong>{formatted || (isento ? 'ISENTO' : '—')}</strong></div>
        </div>
      </section>
    </main>
  )
}
