import type { ClientComparison } from '../types'
import StatusBadge from './StatusBadge'
import { validateCpfCnpj } from '../lib/normalizers'

type Props = {
  client: ClientComparison | null
  onClose: () => void
}

export default function ClientDrawer({ client, onClose }: Props) {
  if (!client) return null
  const docField = client.fields.find(f => f.fieldId === 'cpfCnpj')
  const docValidation = validateCpfCnpj(docField?.originValue)

  return (
    <div className="drawer-overlay" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">ANÁLISE INDIVIDUAL</span>
            <h2>{client.name || 'Cliente sem descrição'}</h2>
            <p>Código {client.key}</p>
          </div>
          <button type="button" className="icon-button large" onClick={onClose}>×</button>
        </div>

        <div className="drawer-summary">
          <StatusBadge status={client.status} />
          <div><strong>{client.divergentCount}</strong><span>divergências</span></div>
          <div><strong>{client.attentionCount}</strong><span>atenções</span></div>
          <div><strong>{client.found ? 'Sim' : 'Não'}</strong><span>encontrado</span></div>
        </div>

        <div className="document-callout">
          <div>
            <span>Validade CPF/CNPJ na origem</span>
            <strong>{docValidation.status}</strong>
          </div>
          <p>{docValidation.detail}</p>
        </div>

        <div className="drawer-fields">
          {client.fields.map(field => (
            <div className={`field-compare field-${field.status.toLowerCase().replace(/[^a-z]/g,'')}`} key={field.fieldId}>
              <div className="field-title">
                <div><span>{field.group}</span><strong>{field.fieldLabel}</strong></div>
                <StatusBadge status={field.status} />
              </div>
              <div className="field-values">
                <div><span>Origem</span><strong>{field.originValue || '—'}</strong></div>
                <div><span>Destino</span><strong>{field.targetValue || '—'}</strong></div>
              </div>
              <p>{field.reason}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
