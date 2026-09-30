import { useMemo, useState } from 'react'

type BarcodeLength = 8 | 12 | 13

const SUPPORTED_LENGTHS: BarcodeLength[] = [8, 12, 13]

function calculateCheckDigit(payload: string) {
  let sum = 0
  let weight = 3
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += Number(payload[index]) * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10
}

function isValidAtLength(digits: string, length: BarcodeLength) {
  if (digits.length !== length) return false
  return String(calculateCheckDigit(digits.slice(0, -1))) === digits.slice(-1)
}

function automaticLength(digits: string): BarcodeLength {
  if (digits.length <= 8) return 8
  if (digits.length <= 12) return 12
  return 13
}

function patternName(length: BarcodeLength) {
  return length === 8 ? 'EAN-8' : length === 12 ? 'UPC-A' : 'EAN-13'
}

export default function BarcodeValidatorPage() {
  const [length, setLength] = useState<BarcodeLength>(8)
  const [value, setValue] = useState('')

  const digits = value.replace(/\D/g, '').slice(0, 13)
  const ready = digits.length === length
  // O último caractere digitado é sempre exibido como DV informado.
  // Nos marcos 8, 12 e 13 ele é validado contra o payload anterior.
  const informedCheckDigit = digits ? digits.slice(-1) : ''
  const informedPayload = digits ? digits.slice(0, -1) : ''
  const payloadForCurrentLength = informedPayload.padStart(length - 1, '0').slice(-(length - 1))
  const calculatedCheckDigit = String(calculateCheckDigit(payloadForCurrentLength))
  const valid = ready && informedCheckDigit === calculatedCheckDigit
  const normalized = digits ? `${payloadForCurrentLength}${informedCheckDigit}` : ''.padStart(length, '0')

  const positions = useMemo(() => {
    const display = normalized
    const paddedCount = digits ? Math.max(0, length - digits.length) : length - 1
    return display.split('').map((digit, index) => ({
      digit,
      check: index === length - 1,
      padded: index < paddedCount,
    }))
  }, [digits, length, normalized])

  const handleLength = (next: BarcodeLength) => {
    setLength(next)
    setValue(current => current.replace(/\D/g, '').slice(0, next))
  }

  const handleBarcodeChange = (rawValue: string) => {
    const nextDigits = rawValue.replace(/\D/g, '').slice(0, 13)
    setValue(nextDigits)

    // A digitação define o padrão. Nos marcos 8, 12 e 13, o último
    // caractere é sempre tratado como DV e validado antes de avançar.
    setLength(automaticLength(nextDigits))
  }

  const nextTarget = length === 8 ? 12 : length === 12 ? 13 : null
  const missing = Math.max(0, length - digits.length)
  const exactSupportedLength = SUPPORTED_LENGTHS.includes(digits.length as BarcodeLength)
  const exactValid = exactSupportedLength && isValidAtLength(digits, digits.length as BarcodeLength)

  return (
    <main className="module-page barcode-validator-page">
      <section className="module-hero">
        <span className="eyebrow">VALIDAÇÃO LOCAL</span>
        <h1>Validação de Código de Barras</h1>
        <p>
          Validação contínua EAN-8, UPC-A (12 dígitos) e EAN-13. Em 8, 12 e 13 posições,
          o último caractere informado é considerado o dígito verificador.
        </p>
      </section>

      <section className="validator-card barcode-validator-card">
        <div className="barcode-length-field">
          <span className="barcode-field-label">Quantidade de dígitos</span>
          <div className="barcode-length-options" role="group" aria-label="Quantidade de dígitos">
            {SUPPORTED_LENGTHS.map(option => (
              <button type="button" key={option} className={length === option ? 'active' : ''}
                aria-pressed={length === option} onClick={() => handleLength(option)}>
                {option} dígitos
              </button>
            ))}
          </div>
        </div>

        <div className="validator-form barcode-form">
          <label className="grow">
            <span>Código de barras</span>
            <input value={digits} inputMode="numeric" autoComplete="off" maxLength={13} autoFocus
              onChange={event => handleBarcodeChange(event.target.value)}
              placeholder="Digite até 13 dígitos" aria-describedby="barcode-help" />
            <small id="barcode-help">
              {digits.length}/{length} dígitos · DV acompanhado a cada caractere · padrões 8, 12 e 13.
            </small>
          </label>
          <button className="button ghost" type="button" onClick={() => setValue('')}>Limpar</button>
        </div>

        <div className="barcode-preview" aria-label={`Código para validação ${normalized}`}>
          <div className="barcode-preview-head">
            <div><span>Código para validação</span><strong>{length} posições · {patternName(length)}</strong></div>
            <span className="barcode-direction">DV sempre destacado</span>
          </div>
          <div className="barcode-digits">
            {positions.map((position, index) => (
              <div key={index} className={['barcode-digit', position.check ? 'check-digit' : '', position.padded ? 'padded-digit' : ''].filter(Boolean).join(' ')}>
                <span>{position.digit}</span><small>{position.check ? 'DV' : index + 1}</small>
              </div>
            ))}
          </div>
          <div className="barcode-legend">
            <span><i className="barcode-legend-zero" /> Zero completado</span>
            <span><i className="barcode-legend-dv" /> Dígito verificador</span>
          </div>
        </div>

        {!digits && <div className="validator-empty">Digite o código. O PrimeCheck acompanha o DV e alterna automaticamente entre 8, 12 e 13 posições.</div>}

        {digits && !ready && (
          <div className="validator-result attention">
            <div className="validator-result-icon">i</div>
            <div>
              <span>CÓDIGO INCOMPLETO</span>
              <strong className="mono">{digits}</strong>
              <p>
                DV informado: {informedCheckDigit}. DV calculado para os dados atuais: {calculatedCheckDigit}. Faltam {missing} dígito(s) para completar {length} posições ({patternName(length)}), contando o DV.
                {nextTarget ? ` Ao ultrapassar ${length} caracteres, o padrão alternará automaticamente para ${nextTarget} posições.` : ''}
              </p>
            </div>
          </div>
        )}

        {digits && ready && (
          <div className={`validator-result ${valid ? 'valid' : 'invalid'}`}>
            <div className="validator-result-icon">{valid ? '✓' : '!'}</div>
            <div>
              <span>{valid ? 'CÓDIGO DE BARRAS VÁLIDO' : 'CÓDIGO DE BARRAS INVÁLIDO'}</span>
              <strong className="mono">{digits}</strong>
              <p>
                {valid
                  ? `${patternName(length)} válido com ${length} dígitos. DV informado ${informedCheckDigit} coincide com o DV calculado ${calculatedCheckDigit}.`
                  : `${patternName(length)} com ${length} dígitos, porém o DV informado ${informedCheckDigit} não coincide com o DV calculado ${calculatedCheckDigit}.`}
              </p>
            </div>
          </div>
        )}

        <div className="validator-details barcode-details">
          <div><span>Padrão atual</span><strong>{patternName(length)}</strong></div>
          <div><span>Valor informado</span><strong className="mono">{digits || '—'}</strong></div>
          <div><span>Código calculado</span><strong className="mono">{digits ? `${payloadForCurrentLength}${calculatedCheckDigit}` : '—'}</strong></div>
          <div className="barcode-dv-detail"><span>Dígito verificador calculado</span><strong>{digits ? calculatedCheckDigit : '—'}</strong></div>
          <div><span>DV informado</span><strong>{digits ? informedCheckDigit : '—'}</strong></div>
          <div><span>Posições</span><strong>{digits.length}/{length}</strong></div>
          <div><span>Situação</span><strong>{!digits ? '—' : !ready ? `Incompleto · faltam ${missing}` : valid ? 'Válido' : 'Inválido'}</strong></div>
          <div><span>Validação no marco atual</span><strong>{exactValid ? 'DV confere' : exactSupportedLength ? 'DV não confere' : 'Aguardando 8, 12 ou 13 dígitos'}</strong></div>
          <div><span>Próximo padrão</span><strong>{nextTarget ? `${nextTarget} dígitos` : 'Limite de 13 dígitos'}</strong></div>
        </div>
      </section>
    </main>
  )
}
