import { useMemo, useState } from 'react'
import { formatCnpj, validateCnpj } from '@br-validators/core/cnpj'

const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

const detectCnpjType = (value: string) => {
  if (!value) return '—'
  if (value.length !== 14) return value.length < 14 ? 'Incompleto' : 'Formato inesperado'
  if (/[A-Z]/.test(value.slice(0, 12)) && /\d{2}$/.test(value)) return 'Alfanumérico'
  if (/^\d{14}$/.test(value)) return 'Numérico'
  return 'Formato inválido'
}

export default function CnpjValidatorPage() {
  const [value, setValue] = useState('')

  const normalized = sanitize(value)
  const result = useMemo(() => normalized ? validateCnpj(normalized) : null, [normalized])
  const formatted = useMemo(() => {
    if (!normalized) return ''
    const response = formatCnpj(normalized)
    return response.ok ? response.formatted : ''
  }, [normalized])
  const cnpjType = detectCnpjType(normalized)
  const motivo = !normalized
    ? 'Informe um CNPJ para validar os dígitos verificadores.'
    : result?.ok
      ? `CNPJ ${cnpjType.toLowerCase()} válido pelo módulo 11, calculado localmente.`
      : result?.message || 'CNPJ inválido pelos dígitos verificadores.'

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
              <strong className="mono">{formatted || normalized}</strong>
              <p>{motivo}</p>
            </div>
          </div>
        )}

        <div className="validator-details">
          <div><span>Valor original</span><strong>{value || '—'}</strong></div>
          <div><span>Valor normalizado</span><strong className="mono">{normalized || '—'}</strong></div>
          <div><span>Quantidade de posições</span><strong>{normalized.length || 0}</strong></div>
          <div><span>Tipo do CNPJ</span><strong>{cnpjType}</strong></div>
          <div><span>Situação</span><strong>{!normalized ? '—' : result?.ok ? 'Válido' : 'Inválido'}</strong></div>
          <div><span>Motivo</span><strong>{motivo}</strong></div>
        </div>
      </section>
    </main>
  )
}
