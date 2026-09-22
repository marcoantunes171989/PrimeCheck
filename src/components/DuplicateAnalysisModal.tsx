import { useEffect, useId, useRef, useState } from 'react'
import {
  buildRecordDisplayFields,
  isMonoDuplicateField,
  sideLabel,
} from '../lib/duplicateDisplay'
import type { DuplicateItem } from '../types'

export type DuplicateAnalysisRequest = {
  fieldId: string
  fieldLabel: string
  normalizedValue: string
  side: DuplicateItem['side']
}

const number = (value: number) => value.toLocaleString('pt-BR')

const slugPart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'valor'

const duplicateImageName = (fieldLabel: string, normalizedValue: string) =>
  `duplicidade-${slugPart(fieldLabel)}-${slugPart(normalizedValue)}.png`

type Props = {
  request: DuplicateAnalysisRequest
  group: DuplicateItem | null
  nameLabel: string
  onClose: () => void
  onOpenDuplicatesScreen: () => void
}

export default function DuplicateAnalysisModal({
  request,
  group,
  nameLabel,
  onClose,
  onOpenDuplicatesScreen,
}: Props) {
  const titleId = useId()
  const subtitleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const captureRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  onCloseRef.current = onClose

  const recordCount = group?.count ?? 0
  const records = group?.records ?? []
  const ctx = {
    fieldId: request.fieldId,
    fieldLabel: request.fieldLabel,
    normalizedValue: request.normalizedValue,
    nameLabel,
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter(node => !node.hasAttribute('disabled') && node.tabIndex !== -1)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const saveAsImage = async () => {
    const node = captureRef.current
    if (!node || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        width: Math.max(node.scrollWidth, node.offsetWidth),
        height: Math.max(node.scrollHeight, node.offsetHeight),
        style: {
          overflow: 'visible',
          height: 'auto',
          maxHeight: 'none',
        },
      })
      const link = document.createElement('a')
      link.download = duplicateImageName(request.fieldLabel, request.normalizedValue)
      link.href = dataUrl
      link.click()
    } catch {
      setSaveError('Não foi possível gerar a imagem desta duplicidade.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="dup-analysis-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="dup-analysis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
      >
        <div className="dup-analysis-chrome">
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button large"
            onClick={onClose}
            aria-label="Fechar análise de duplicidade"
          >
            ×
          </button>
        </div>

        <div className="dup-analysis-scroll">
          <div ref={captureRef} className="dup-analysis-capture">
            <header className="dup-analysis-head">
              <span className="eyebrow">PRIMECHECK</span>
              <h2 id={titleId}>Análise de duplicidade</h2>
              <p id={subtitleId}>
                {request.fieldLabel}
                <span> · </span>
                <strong className="mono">{request.normalizedValue || '—'}</strong>
                {group ? (
                  <>
                    <span> · </span>
                    {number(recordCount)} {recordCount === 1 ? 'registro encontrado' : 'registros encontrados'}
                    <span> · </span>
                    {sideLabel(request.side)}
                  </>
                ) : null}
              </p>
            </header>

            {!group ? (
              <div className="dup-analysis-empty" role="status">
                <strong>Nenhum detalhe analítico encontrado para esta duplicidade.</strong>
                <span>O indicador permanece disponível, mas o grupo correspondente não foi localizado na análise atual.</span>
              </div>
            ) : (
              <>
                <section className="dup-analysis-summary" aria-label="Resumo da duplicidade">
                  <div>
                    <span>Campo duplicado</span>
                    <strong>{group.fieldLabel}</strong>
                  </div>
                  <div>
                    <span>Valor</span>
                    <strong className="mono">{group.normalizedValue || '—'}</strong>
                  </div>
                  <div>
                    <span>Quantidade</span>
                    <strong>{number(group.count)} {group.count === 1 ? 'registro' : 'registros'}</strong>
                  </div>
                  <div>
                    <span>Lado</span>
                    <strong>{sideLabel(group.side)}</strong>
                  </div>
                  <div>
                    <span>Tipo</span>
                    <strong>{group.category}</strong>
                  </div>
                </section>

                <section className="dup-analysis-records" aria-label="Registros do grupo">
                  {records.map((record, index) => {
                    const fields = buildRecordDisplayFields(record, ctx)
                    const codeField = fields.find(field => field.id === '__codigo')
                    const nameField = fields.find(field => field.id === '__nome')
                    const duplicatedField = fields.find(field => field.id === group.fieldId)
                    const otherFields = fields.filter(field =>
                      field.id !== '__codigo'
                      && field.id !== '__nome'
                      && field.id !== group.fieldId
                      && field.value.trim(),
                    )

                    return (
                      <article className="dup-analysis-card" key={`${record.key}-${index}`}>
                        <header className="dup-analysis-card-head">
                          <span>Registro {index + 1}</span>
                          <b className="mono">{codeField?.value ? `Código: ${codeField.value}` : 'Código: —'}</b>
                        </header>
                        <h3>{nameField?.value || 'Sem descrição'}</h3>
                        {duplicatedField && (
                          <div className="dup-analysis-highlight">
                            <span>{duplicatedField.label}</span>
                            <strong className={isMonoDuplicateField(duplicatedField.id) ? 'mono' : undefined}>
                              {duplicatedField.value || group.normalizedValue || '—'}
                            </strong>
                          </div>
                        )}
                        <dl className="dup-analysis-fields">
                          {otherFields.map(field => (
                            <div key={field.id}>
                              <dt>{field.label}</dt>
                              <dd className={isMonoDuplicateField(field.id) ? 'mono' : undefined}>
                                {field.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    )
                  })}
                </section>
              </>
            )}
          </div>
        </div>

        <footer className="dup-analysis-actions">
          {saveError ? <p className="dup-analysis-error">{saveError}</p> : null}
          <div className="dup-analysis-actions-row">
            <button
              type="button"
              className="button ghost compact-button"
              onClick={onOpenDuplicatesScreen}
            >
              Abrir na tela de Duplicidades
            </button>
            <div className="dup-analysis-actions-end">
              <button
                type="button"
                className="button primary compact-button"
                onClick={() => { void saveAsImage() }}
                disabled={!group || saving}
              >
                {saving ? 'Gerando imagem...' : 'Salvar como imagem'}
              </button>
              <button
                type="button"
                className="button ghost compact-button"
                onClick={onClose}
              >
                Fechar
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
