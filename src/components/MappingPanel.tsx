import { useMemo, useState } from 'react'
import { CHECKLIST_FIELDS } from '../config/checklist'
import type { FieldMapping } from '../types'
import { getHeaderSuggestions, mappingCoverage } from '../lib/mapping'
import { normalizeHeader } from '../lib/normalizers'

type Props = {
  mapping: FieldMapping[]
  originHeaders: string[]
  targetHeaders: string[]
  onChange: (mapping: FieldMapping[]) => void
  onAutoMap: () => void
}

export default function MappingPanel({
  mapping,
  originHeaders,
  targetHeaders,
  onChange,
  onAutoMap,
}: Props) {
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)

  const coverage = mappingCoverage(mapping)
  const coveragePercent = coverage.total ? Math.round((coverage.both / coverage.total) * 100) : 0

  const update = (fieldId: string, side: 'originHeader' | 'targetHeader', value: string) => {
    onChange(mapping.map(item => item.fieldId === fieldId ? { ...item, [side]: value } : item))
  }

  const visibleFields = useMemo(() => {
    const term = normalizeHeader(search)

    return CHECKLIST_FIELDS.filter(field => {
      const item = mapping.find(map => map.fieldId === field.id)
      const pending = !item?.originHeader || !item?.targetHeader
      if (onlyPending && !pending) return false
      if (!term) return true

      const haystack = [
        field.label,
        field.group,
        item?.originHeader ?? '',
        item?.targetHeader ?? '',
      ].map(normalizeHeader).join(' ')

      return haystack.includes(term)
    })
  }, [mapping, onlyPending, search])

  return (
    <section className="panel mapping-panel">
      <div className="section-head mapping-head">
        <div>
          <div className="mapping-title-line">
            <span className="eyebrow">ETAPA 2</span>
            <span className="mapping-profile-badge">Mapeamento inteligente</span>
          </div>
          <h2>Vincule os campos da conversão</h2>
          <p>
            Acentos e caracteres corrompidos são tratados automaticamente. O PrimeCheck tenta
            reconhecer o máximo de colunas possível e mantém casos ambíguos para confirmação humana.
          </p>
        </div>

        <div className="coverage-card">
          <div className="coverage">
            <strong>{coverage.both}/{coverage.total}</strong>
            <span>campos comparáveis</span>
          </div>
          <div className="coverage-progress" aria-label={String(coveragePercent) + '% dos campos mapeados'}>
            <i style={{ width: String(coveragePercent) + '%' }} />
          </div>
          <small>{coveragePercent}% vinculado</small>
        </div>
      </div>

      <div className="mapping-toolbar">
        <div className="mapping-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar campo ou coluna…"
            aria-label="Pesquisar mapeamento"
          />
        </div>
        <label className="mapping-toggle">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={event => setOnlyPending(event.target.checked)}
          />
          <span>Mostrar somente pendentes</span>
        </label>
        <button type="button" className="button secondary" onClick={onAutoMap}>
          Refazer vínculo automático
        </button>
      </div>

      <div className="mapping-legend">
        <span><i className="dot dot-green" /> Pronto para comparar</span>
        <span><i className="dot dot-yellow" /> Requer confirmação</span>
        <span><i className="dot dot-gray" /> Não identificado</span>
        <span className="mapping-safe-note">
          Convênio/EMPRESA genéricos continuam protegidos contra vínculo incorreto.
        </span>
      </div>

      <div className="table-wrap mapping-table-wrap">
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
            {visibleFields.map(field => {
              const item = mapping.find(map => map.fieldId === field.id)!
              const situation = item?.originHeader && item?.targetHeader
                ? 'ok'
                : item?.originHeader || item?.targetHeader
                  ? 'partial'
                  : 'none'

              const originSuggestions = !item?.originHeader
                ? getHeaderSuggestions(originHeaders, field.id)
                : []
              const targetSuggestions = !item?.targetHeader
                ? getHeaderSuggestions(targetHeaders, field.id)
                : []

              return (
                <tr key={field.id} className={'mapping-row ' + situation}>
                  <td className="muted-cell">
                    <span className="mapping-group">{field.group}</span>
                  </td>
                  <td>
                    <strong>{field.label}</strong>
                    {field.requiredForMatch && <span className="required">chave</span>}
                  </td>
                  <td>
                    <select
                      value={item?.originHeader ?? ''}
                      onChange={event => update(field.id, 'originHeader', event.target.value)}
                      title={item?.originHeader || 'Selecionar coluna da origem'}
                    >
                      <option value="">Não mapeado</option>
                      {originHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!item?.originHeader && originSuggestions.length > 0 && (
                      <div className="mapping-suggestions">
                        <span>Sugestões:</span>
                        {originSuggestions.map(suggestion => (
                          <button
                            type="button"
                            key={suggestion.header}
                            onClick={() => update(field.id, 'originHeader', suggestion.header)}
                            title={'Compatibilidade ' + suggestion.score + '%'}
                          >
                            {suggestion.header}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      value={item?.targetHeader ?? ''}
                      onChange={event => update(field.id, 'targetHeader', event.target.value)}
                      title={item?.targetHeader || 'Selecionar coluna do destino'}
                    >
                      <option value="">Não mapeado</option>
                      {targetHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!item?.targetHeader && targetSuggestions.length > 0 && (
                      <div className="mapping-suggestions">
                        <span>Sugestões:</span>
                        {targetSuggestions.map(suggestion => (
                          <button
                            type="button"
                            key={suggestion.header}
                            onClick={() => update(field.id, 'targetHeader', suggestion.header)}
                            title={'Compatibilidade ' + suggestion.score + '%'}
                          >
                            {suggestion.header}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={'map-state ' + situation}>
                      {situation === 'ok' ? 'Pronto' : situation === 'partial' ? 'Parcial' : 'Não identificado'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visibleFields.length === 0 && (
          <div className="mapping-empty">
            Nenhum campo corresponde ao filtro atual.
          </div>
        )}
      </div>
    </section>
  )
}
