import { useMemo, useState } from 'react'
import type { EntityProfile, FieldMapping } from '../types'
import { getHeaderSuggestions, mappingCoverage } from '../lib/mapping'
import { normalizeHeader } from '../lib/normalizers'

type Props = {
  profile: EntityProfile
  mapping: FieldMapping[]
  originHeaders: string[]
  targetHeaders: string[]
  onChange: (mapping: FieldMapping[]) => void
  onAutoMap: () => void
}

export default function MappingPanel({
  profile,
  mapping,
  originHeaders,
  targetHeaders,
  onChange,
  onAutoMap,
}: Props) {
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)

  const coverage = mappingCoverage(mapping)
  const total = profile.fields.length || coverage.total
  const both = coverage.both
  const coveragePercent = total ? Math.round((both / total) * 100) : 0

  const update = (fieldId: string, side: 'originHeader' | 'targetHeader', value: string) => {
    const current = mapping.find(item => item.fieldId === fieldId)
    if (!current) {
      onChange([...mapping, {
        fieldId,
        originHeader: side === 'originHeader' ? value : '',
        targetHeader: side === 'targetHeader' ? value : '',
      }])
      return
    }
    onChange(mapping.map(item => item.fieldId === fieldId ? { ...item, [side]: value } : item))
  }

  const visibleFields = useMemo(() => {
    const term = normalizeHeader(search)

    return profile.fields.filter(field => {
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
  }, [mapping, onlyPending, profile.fields, search])

  return (
    <section className="panel mapping-panel">
      <div className="section-head mapping-head">
        <div>
          <div className="mapping-title-line">
            <span className="eyebrow">ETAPA 2</span>
            <span className="mapping-profile-badge">{profile.label}</span>
          </div>
          <h2>Mapeamento dos campos</h2>
          <p>
            Acentos e caracteres corrompidos são tratados automaticamente. O PrimeCheck tenta
            reconhecer o máximo de colunas possível e mantém casos ambíguos para confirmação humana.
          </p>
        </div>

        <div className="coverage-card">
          <div className="coverage">
            <strong>{both}/{total}</strong>
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
        <span><i className="dot dot-green" /> Pronto</span>
        <span><i className="dot dot-yellow" /> Parcial</span>
        <span><i className="dot dot-gray" /> Não identificado</span>
        <span className="mapping-safe-note">
          Colunas genéricas ou ambíguas não são auto-vinculadas. Use as sugestões quando houver dúvida.
        </span>
      </div>

      <div className="table-wrap mapping-table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Campo homologado</th>
              <th>Coluna origem</th>
              <th>Coluna destino</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map(field => {
              const item = mapping.find(map => map.fieldId === field.id)
              const originHeader = item?.originHeader ?? ''
              const targetHeader = item?.targetHeader ?? ''
              const situation = originHeader && targetHeader
                ? 'ok'
                : originHeader || targetHeader
                  ? 'partial'
                  : 'none'

              const originSuggestions = !originHeader
                ? getHeaderSuggestions(originHeaders, field)
                : []
              const targetSuggestions = !targetHeader
                ? getHeaderSuggestions(targetHeaders, field)
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
                      value={originHeader}
                      onChange={event => update(field.id, 'originHeader', event.target.value)}
                      title={originHeader || 'Selecionar coluna da origem'}
                    >
                      <option value="">Não mapeado</option>
                      {originHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!originHeader && originSuggestions.length > 0 && (
                      <div className="mapping-suggestions">
                        <span>Sugestões:</span>
                        {originSuggestions.map(suggestion => (
                          <button
                            type="button"
                            key={suggestion.header}
                            onClick={() => update(field.id, 'originHeader', suggestion.header)}
                            title={'Compatibilidade: ' + suggestion.score + '%'}
                          >
                            {suggestion.header}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      value={targetHeader}
                      onChange={event => update(field.id, 'targetHeader', event.target.value)}
                      title={targetHeader || 'Selecionar coluna do destino'}
                    >
                      <option value="">Não mapeado</option>
                      {targetHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {!targetHeader && targetSuggestions.length > 0 && (
                      <div className="mapping-suggestions">
                        <span>Sugestões:</span>
                        {targetSuggestions.map(suggestion => (
                          <button
                            type="button"
                            key={suggestion.header}
                            onClick={() => update(field.id, 'targetHeader', suggestion.header)}
                            title={'Compatibilidade: ' + suggestion.score + '%'}
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
