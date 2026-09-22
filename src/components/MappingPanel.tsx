import { CHECKLIST_FIELDS } from '../config/checklist'
import type { FieldMapping } from '../types'
import { mappingCoverage } from '../lib/mapping'

type Props = {
  mapping: FieldMapping[]
  originHeaders: string[]
  targetHeaders: string[]
  onChange: (mapping: FieldMapping[]) => void
}

export default function MappingPanel({ mapping, originHeaders, targetHeaders, onChange }: Props) {
  const coverage = mappingCoverage(mapping)
  const update = (fieldId: string, side: 'originHeader' | 'targetHeader', value: string) => {
    onChange(mapping.map(m => m.fieldId === fieldId ? { ...m, [side]: value } : m))
  }

  return (
    <section className="panel mapping-panel">
      <div className="section-head">
        <div>
          <div className="mapping-title-line">
            <span className="eyebrow">ETAPA 2</span>
            <span className="mapping-profile-badge">Perfil local reativado</span>
          </div>
          <h2>Mapeamento dos campos</h2>
          <p>O vínculo automático prioriza os mesmos nomes e regras usados na validação local. Campos não identificados ou ambíguos permanecem disponíveis para seleção manual antes da homologação.</p>
        </div>
        <div className="coverage">
          <strong>{coverage.both}/{coverage.total}</strong>
          <span>campos comparáveis</span>
        </div>
      </div>

      <div className="mapping-legend">
        <span><i className="dot dot-green" /> Origem e destino mapeados</span>
        <span><i className="dot dot-yellow" /> Mapeamento parcial</span>
        <span><i className="dot dot-gray" /> Não identificado</span>
        <span className="mapping-safe-note">Colunas ambíguas de Convênio não são vinculadas automaticamente.</span>
      </div>

      <div className="table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Campo homologado</th>
              <th>Coluna da origem</th>
              <th>Coluna do destino</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {CHECKLIST_FIELDS.map(field => {
              const item = mapping.find(m => m.fieldId === field.id)!
              const situation = item?.originHeader && item?.targetHeader ? 'ok' : item?.originHeader || item?.targetHeader ? 'partial' : 'none'
              return (
                <tr key={field.id}>
                  <td className="muted-cell">{field.group}</td>
                  <td><strong>{field.label}</strong>{field.requiredForMatch && <span className="required">chave</span>}</td>
                  <td>
                    <select value={item?.originHeader ?? ''} onChange={e => update(field.id, 'originHeader', e.target.value)}>
                      <option value="">Não mapeado</option>
                      {originHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={item?.targetHeader ?? ''} onChange={e => update(field.id, 'targetHeader', e.target.value)}>
                      <option value="">Não mapeado</option>
                      {targetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </td>
                  <td><span className={`map-state ${situation}`}>{situation === 'ok' ? 'Pronto' : situation === 'partial' ? 'Parcial' : 'Não identificado'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
