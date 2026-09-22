import { useEffect, useState } from 'react'
import type { ClientComparison, ComparisonFieldResult } from '../types'
import type { ManualAdjustmentInput, ManualReviewStatus } from '../lib/compare'
import StatusBadge from './StatusBadge'
import { validateCpfCnpj } from '../lib/normalizers'

type OccurrenceNav = {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
}

type Props = {
  client: ClientComparison | null
  recordLabel?: string
  showDocumentValidity?: boolean
  focusedFieldId?: string
  occurrenceNav?: OccurrenceNav
  onClose: () => void
  onApplyManualAdjustment: (
    clientKey: string,
    fieldId: string,
    input: ManualAdjustmentInput,
  ) => void
  onRevertManualAdjustment: (clientKey: string, fieldId: string) => void
}

export default function ClientDrawer({
  client,
  recordLabel = 'Registro',
  showDocumentValidity = false,
  focusedFieldId,
  occurrenceNav,
  onClose,
  onApplyManualAdjustment,
  onRevertManualAdjustment,
}: Props) {
  const [editingFieldId, setEditingFieldId] = useState('')
  const [adjustedValue, setAdjustedValue] = useState('')
  const [manualStatus, setManualStatus] = useState<ManualReviewStatus>('AUTO')
  const [note, setNote] = useState('')

  useEffect(() => {
    setEditingFieldId('')
    setAdjustedValue('')
    setManualStatus('AUTO')
    setNote('')
  }, [client?.key])

  useEffect(() => {
    if (!client || !focusedFieldId) return
    const el = document.getElementById(`drawer-field-${focusedFieldId}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [client?.key, focusedFieldId])

  if (!client) return null

  const docField = client.fields.find(field => field.fieldId === 'cpfCnpj')
  const docValidation = validateCpfCnpj(docField?.originValue)

  const startMaintenance = (field: ComparisonFieldResult) => {
    setEditingFieldId(field.fieldId)
    setAdjustedValue(field.targetValue)
    setManualStatus(field.manualAdjustment ? field.manualAdjustment.status : 'AUTO')
    setNote(field.manualAdjustment?.note ?? '')
  }

  const cancelMaintenance = () => {
    setEditingFieldId('')
    setAdjustedValue('')
    setManualStatus('AUTO')
    setNote('')
  }

  const saveMaintenance = (field: ComparisonFieldResult) => {
    onApplyManualAdjustment(client.key, field.fieldId, {
      adjustedValue,
      status: manualStatus,
      note,
    })
    cancelMaintenance()
  }

  return (
    <div className="drawer-overlay" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={event => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">ANÁLISE INDIVIDUAL</span>
            <h2>{client.name || `${recordLabel} sem descrição`}</h2>
            <p>Código {client.key}</p>
          </div>
          <button type="button" className="icon-button large" onClick={onClose}>×</button>
        </div>

        {occurrenceNav && occurrenceNav.total > 1 && (
          <div className="occurrence-nav">
            <button
              type="button"
              className="button ghost compact-button"
              disabled={occurrenceNav.current <= 0}
              onClick={occurrenceNav.onPrev}
              aria-label="Ocorrência anterior"
            >
              ← Anterior
            </button>
            <span>{occurrenceNav.current + 1} de {occurrenceNav.total}</span>
            <button
              type="button"
              className="button ghost compact-button"
              disabled={occurrenceNav.current >= occurrenceNav.total - 1}
              onClick={occurrenceNav.onNext}
              aria-label="Próxima ocorrência"
            >
              Próximo →
            </button>
          </div>
        )}

        <div className="drawer-summary">
          <StatusBadge status={client.status} />
          <div><strong>{client.divergentCount}</strong><span>divergências</span></div>
          <div><strong>{client.attentionCount}</strong><span>atenções</span></div>
          <div><strong>{client.found ? 'Sim' : 'Não'}</strong><span>encontrado</span></div>
        </div>

        {showDocumentValidity && (
          <div className="document-callout">
            <div>
              <span>Validade CPF/CNPJ na origem</span>
              <strong>{docValidation.status}</strong>
            </div>
            <p>{docValidation.detail}</p>
          </div>
        )}

        <div className="manual-maintenance-info">
          <strong>Manutenção manual da homologação</strong>
          <span>
            Ajustes feitos aqui ficam somente nesta análise e aparecem nas exportações.
            O arquivo original importado não é alterado.
          </span>
        </div>

        <div className="drawer-fields">
          {client.fields.map(field => {
            const editing = editingFieldId === field.fieldId
            const focused = focusedFieldId === field.fieldId
            const canMaintain =
              client.found &&
              (field.status !== 'CONFORME' || Boolean(field.manualAdjustment))

            return (
              <div
                className={`field-compare field-${field.status.toLowerCase().replace(/[^a-z]/g, '')}${focused ? ' field-compare-focused' : ''}`}
                key={field.fieldId}
                id={`drawer-field-${field.fieldId}`}
                aria-current={focused ? 'true' : undefined}
              >
                <div className="field-title">
                  <div>
                    <span>{field.group}</span>
                    <strong>{field.fieldLabel}</strong>
                    {focused && (
                      <em className="manual-tag">Campo em análise</em>
                    )}
                    {field.manualAdjustment && (
                      <em className="manual-tag">Ajustado manualmente</em>
                    )}
                  </div>
                  <StatusBadge status={field.status} />
                </div>

                <div className="field-values">
                  <div>
                    <span>Origem</span>
                    <strong>{field.originValue || '—'}</strong>
                  </div>
                  <div>
                    <span>{field.manualAdjustment ? 'Destino ajustado' : 'Destino'}</span>
                    <strong>{field.targetValue || '—'}</strong>
                    {field.manualAdjustment && (
                      <small>
                        Original: {field.manualAdjustment.originalTargetValue || '—'}
                      </small>
                    )}
                  </div>
                </div>

                <p>{field.reason}</p>

                {field.manualAdjustment?.note && (
                  <div className="manual-note">
                    <strong>Observação:</strong> {field.manualAdjustment.note}
                  </div>
                )}

                {canMaintain && !editing && (
                  <div className="field-actions">
                    <button
                      type="button"
                      className="button secondary compact-button"
                      onClick={() => startMaintenance(field)}
                    >
                      {field.manualAdjustment ? 'Editar ajuste' : 'Manutenção manual'}
                    </button>
                    {field.manualAdjustment && (
                      <button
                        type="button"
                        className="button ghost compact-button"
                        onClick={() => onRevertManualAdjustment(client.key, field.fieldId)}
                      >
                        Reverter ajuste
                      </button>
                    )}
                  </div>
                )}

                {editing && (
                  <div className="manual-editor">
                    <div className="manual-editor-grid">
                      <label>
                        <span>Valor considerado no destino</span>
                        <input
                          value={adjustedValue}
                          onChange={event => setAdjustedValue(event.target.value)}
                          placeholder="Informe o valor corrigido"
                        />
                      </label>

                      <label>
                        <span>Classificação</span>
                        <select
                          value={manualStatus}
                          onChange={event =>
                            setManualStatus(event.target.value as ManualReviewStatus)
                          }
                        >
                          <option value="AUTO">Revalidar automaticamente</option>
                          <option value="CONFORME">Conforme</option>
                          <option value="ATENÇÃO">Atenção</option>
                          <option value="DIVERGENTE">Divergente</option>
                          <option value="NÃO VALIDÁVEL">Não validável</option>
                        </select>
                      </label>
                    </div>

                    <label className="manual-note-field">
                      <span>Observação da análise manual</span>
                      <textarea
                        value={note}
                        onChange={event => setNote(event.target.value)}
                        placeholder="Ex.: valor conferido no sistema de origem; corrigir regra de conversão."
                        rows={3}
                      />
                    </label>

                    <div className="manual-editor-actions">
                      <button
                        type="button"
                        className="button ghost compact-button"
                        onClick={() => setAdjustedValue(field.originValue)}
                      >
                        Usar valor da origem
                      </button>
                      <div>
                        <button
                          type="button"
                          className="button ghost compact-button"
                          onClick={cancelMaintenance}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="button primary compact-button"
                          onClick={() => saveMaintenance(field)}
                        >
                          Aplicar manutenção
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
