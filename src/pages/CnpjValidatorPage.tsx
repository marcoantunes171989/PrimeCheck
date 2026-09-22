import { useMemo, useState } from 'react'
import { formatCnpj, validateCnpj } from '@br-validators/core/cnpj'

const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

export default function CnpjValidatorPage() {
  const [value, setValue] = useState('')

  const normalized = sanitize(value)
  const result = useMemo(() => normalized ? validateCnpj(normalized) : null, [normalized])
  const formatted = useMemo(() => {
    if (!normalized) return ''
    const response = formatCnpj(normalized)
    return response.ok ? response.formatted : ''
  }, [normalized])

  return (
    <main className="module-page">
      <section className="module-hero">
        <span className="eyebrow">VALIDAÇÃO LOCAL</span>
        <h1>Validação de CNPJ</h1>
        <p>
          Validação matemática executada no navegador, inclusive para o formato alfanumérico.
          Nenhum documento é enviado para API externa.
        </p>
      </section>

      <section className="validator-card">
        <div className="validator-form">
          <label>
            <span>CNPJ</span>
            <input
              value={value}
              onChange={event => setValue(event.target.value)}
              placeholder="Digite ou cole o CNPJ"
              autoFocus
            />
          </label>
          <button className="button ghost" type="button" onClick={() => setValue('')}>Limpar</button>
        </div>

        {!normalized && (
          <div className="validator-empty">
            Informe um CNPJ para validar os dígitos verificadores.
          </div>
        )}

        {result && (
          <div className={`validator-result ${result.ok ? 'valid' : 'invalid'}`}>
            <div className="validator-result-icon">{result.ok ? '✓' : '!'}</div>
            <div>
              <span>{result.ok ? 'CNPJ VÁLIDO' : 'CNPJ INVÁLIDO'}</span>
              <strong>{formatted || normalized}</strong>
              <p>
                {result.ok
                  ? `Documento validado localmente. Formato: ${result.format === 'alphanumeric' ? 'alfanumérico' : 'numérico'}.`
                  : result.message}
              </p>
            </div>
          </div>
        )}

        <div className="validator-details">
          <div><span>Valor informado</span><strong>{value || '—'}</strong></div>
          <div><span>Valor normalizado</span><strong className="mono">{normalized || '—'}</strong></div>
          <div><span>Quantidade de posições</span><strong>{normalized.length || 0}</strong></div>
        </div>
      </section>
    </main>
  )
}
