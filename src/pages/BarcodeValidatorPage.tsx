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

export default function BarcodeValidatorPage() {
  const [length, setLength] = useState<BarcodeLength>(13)
  const [value, setValue] = useState('')

  const digits = value.replace(/\D/g, '').slice(0, length)
  const completed = digits.padStart(length, '0')
  const payload = completed.slice(0, -1)
  const informedCheckDigit = completed.slice(-1)
  const calculatedCheckDigit = String(calculateCheckDigit(payload))
  const livePayload = digits.padStart(Math.max(0, length - 1), '0').slice(-(length - 1))
  const liveCheckDigit = String(calculateCheckDigit(livePayload))
  const liveCompleted = `${livePayload}${liveCheckDigit}`
  const ready = digits.length === length
  const valid = ready && informedCheckDigit === calculatedCheckDigit

  const positions = useMemo(
    () => completed.split('').map((digit, index) => ({
      digit,
      check: index === length - 1,
      padded: index < length - digits.length,
    })),
    [completed, digits.length, length],
  )

  const handleLength = (next: BarcodeLength) => {
    setLength(next)
    setValue(current => current.replace(/\D/g, '').slice(-next))
  }

  return (
    <main className="module-page barcode-validator-page">
      <section className="module-hero">
        <span className="eyebrow">VALIDAÇÃO LOCAL</span>
        <h1>Validação de Código de Barras</h1>
        <p>
          Valide códigos EAN-8, UPC-A (12 dígitos) e EAN-13. Zeros à esquerda são preservados
          e, quando necessário, o código é completado da direita para a esquerda.
        </p>
      </section>

      <section className="validator-card barcode-validator-card">
        <div className="barcode-length-field">
          <span className="barcode-field-label">Quantidade de dígitos</span>
          <div className="barcode-length-options" role="group" aria-label="Quantidade de dígitos">
            {SUPPORTED_LENGTHS.map(option => (
              <button
                type="button"
                key={option}
                className={length === option ? 'active' : ''}
                aria-pressed={length === option}
                onClick={() => handleLength(option)}
              >
                {option} dígitos
              </button>
            ))}
          </div>
        </div>

        <div className="validator-form barcode-form">
          <label className="grow">
            <span>Código de barras</span>
            <input
              value={digits}
              inputMode="numeric"
              autoComplete="off"
              maxLength={length}
              autoFocus
              onChange={event => setValue(event.target.value.replace(/\D/g, '').slice(0, length))}
              placeholder={`Digite até ${length} dígitos`}
              aria-describedby="barcode-help"
            />
            <small id="barcode-help">
              {digits.length}/{length} dígitos informados · zeros à esquerda são considerados.
            </small>
            {digits && !ready && (
              <div className="barcode-live-dv" aria-live="polite">
                <span>DV calculado em tempo real</span>
                <strong>{liveCheckDigit}</strong>
                <small className="mono">{liveCompleted}</small>
              </div>
            )}
          </label>
          <button className="button ghost" type="button" onClick={() => setValue('')}>Limpar</button>
        </div>

        <div className="barcode-preview" aria-label={`Código normalizado ${completed}`}>
          <div className="barcode-preview-head">
            <div>
              <span>Código normalizado</span>
              <strong>{length} posições</strong>
            </div>
            <span className="barcode-direction">← completa com zero à esquerda</span>
          </div>
          <div className="barcode-digits">
            {positions.map((position, index) => (
              <div
                key={index}
                className={[
                  'barcode-digit',
                  position.check ? 'check-digit' : '',
                  position.padded ? 'padded-digit' : '',
                ].filter(Boolean).join(' ')}
                title={position.check ? 'Dígito verificador' : position.padded ? 'Zero completado à esquerda' : `Posição ${index + 1}`}
              >
                <span>{position.digit}</span>
                <small>{position.check ? 'DV' : index + 1}</small>
              </div>
            ))}
          </div>
          <div className="barcode-legend">
            <span><i className="barcode-legend-zero" /> Zero completado</span>
            <span><i className="barcode-legend-dv" /> Dígito verificador</span>
          </div>
        </div>

        {!digits && (
          <div className="validator-empty">
            Selecione o tamanho e informe o código. O último dígito é tratado como dígito verificador.
          </div>
        )}

        {digits && !ready && (
          <div className="validator-result attention">
            <div className="validator-result-icon">i</div>
            <div>
              <span>PRÉ-VISUALIZAÇÃO</span>
              <strong className="mono">{completed}</strong>
              <p>
                Faltam {length - digits.length} dígito(s). Com os caracteres informados até agora,
                completados com zero à esquerda, o dígito verificador calculado é {liveCheckDigit}.
              </p>
            </div>
          </div>
        )}

        {ready && (
          <div className={`validator-result ${valid ? 'valid' : 'invalid'}`}>
            <div className="validator-result-icon">{valid ? '✓' : '!'}</div>
            <div>
              <span>{valid ? 'CÓDIGO VÁLIDO' : 'CÓDIGO INVÁLIDO'}</span>
              <strong className="mono">{completed}</strong>
              <p>
                Dígito verificador informado: {informedCheckDigit}. Dígito verificador calculado: {calculatedCheckDigit}.
              </p>
            </div>
          </div>
        )}

        <div className="validator-details barcode-details">
          <div><span>Padrão</span><strong>{length === 8 ? 'EAN-8' : length === 12 ? 'UPC-A' : 'EAN-13'}</strong></div>
          <div><span>Valor informado</span><strong className="mono">{digits || '—'}</strong></div>
          <div><span>Valor normalizado</span><strong className="mono">{digits ? completed : '—'}</strong></div>
          <div className="barcode-dv-detail"><span>Dígito verificador</span><strong>{digits ? (ready ? calculatedCheckDigit : liveCheckDigit) : '—'}</strong></div>
          <div><span>Posições informadas</span><strong>{digits.length}/{length}</strong></div>
          <div><span>Situação</span><strong>{!digits ? '—' : !ready ? 'Aguardando código completo' : valid ? 'Válido' : 'Inválido'}</strong></div>
        </div>
      </section>
    </main>
  )
}
