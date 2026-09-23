import { useMemo, useState } from 'react'
import type { EntityProfile, FieldMapping } from '../types'
import { getHeaderSuggestions, mappingCoverage } from '../lib/mapping'
import { normalizeHeader } from '../lib/normalizers'
import SearchableColumnSelect from './SearchableColumnSelect'

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
    const manualKey = side === 'originHeader' ? 'originManual' : 'targetManual'
    const current = mapping.find(item => item.fieldId === fieldId)
    if (!current) {
      onChange([...mapping, {
        fieldId,
        originHeader: side === 'originHeader' ? value : '',
        targetHeader: side === 'targetHeader' ? value : '',
        [manualKey]: Boolean(value),
      }])
      return
    }
    onChange(mapping.map(item => item.fieldId === fieldId
      ? { ...item, [side]: value, [manualKey]: Boolean(value) }
      : item))
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
        field.checklistLabel ?? '',
        field.databaseField ?? '',
        field.group,
        item?.originHeader ?? '',
        item?.targetHeader ?? '',
      ].map(normalizeHeader).join(' ')

      return haystack.includes(term)
    })
  }, [mapping, onlyPending, profile.fields, search])

  const clientChecklistMode = profile.id === 'client' || profile.id === 'workspace:clients'

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
        <span><i className="dot dot-yellow" /> Manual / Parcial</span>
        <span><i className="dot dot-gray" /> Não identificado</span>
        <span className="mapping-safe-note">
          Colunas genéricas ou ambíguas não são auto-vinculadas. Use as sugestões quando houver dúvida.
        </span>
      </div>

      <div className="table-wrap mapping-table-wrap stable-filter-table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>{clientChecklistMode ? 'Check-list Homologação' : 'Grupo'}</th>
              <th>{clientChecklistMode ? 'Campo no banco de dados' : 'Campo homologado'}</th>
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
              const manual = Boolean(item?.originManual || item?.targetManual)
              const situation = originHeader && targetHeader
                ? manual ? 'manual' : 'ok'
                : originHeader || targetHeader
                  ? 'partial'
                  : 'none'

              const originSuggestions = !clientChecklistMode && !originHeader
                ? getHeaderSuggestions(originHeaders, field)
                : []
              const targetSuggestions = !clientChecklistMode && !targetHeader
                ? getHeaderSuggestions(targetHeaders, field)
                : []

              return (
                <tr key={field.id} className={'mapping-row ' + situation}>
                  <td className={clientChecklistMode ? 'muted-cell mapping-checklist-cell' : 'muted-cell'}>
                    {clientChecklistMode && <span className="mapping-checklist-mark" aria-hidden="true">✓</span>}
                    <span className="mapping-group">
                      {clientChecklistMode ? (field.checklistLabel ?? field.label) : field.group}
                    </span>
                  </td>
                  <td className={clientChecklistMode ? 'mapping-database-field' : undefined}>
                    <strong>{clientChecklistMode ? (field.databaseField || '—') : field.label}</strong>
                    {field.requiredForMatch && <span className="required">chave</span>}
                  </td>
                  <td>
                    <SearchableColumnSelect
                      options={originHeaders}
                      value={originHeader}
                      onChange={value => update(field.id, 'originHeader', value)}
                      placeholder="Selecionar coluna da origem"
                      ariaLabel={'Coluna de origem para ' + field.label}
                    />
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
                    <SearchableColumnSelect
                      options={targetHeaders}
                      value={targetHeader}
                      onChange={value => update(field.id, 'targetHeader', value)}
                      placeholder="Selecionar coluna do destino"
                      ariaLabel={'Coluna de destino para ' + field.label}
                    />
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
                      {situation === 'ok'
                        ? 'Pronto'
                        : situation === 'manual'
                          ? 'Manual'
                          : situation === 'partial'
                            ? 'Parcial'
                            : 'Não identificado'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

      </div>
    </section>
  )
}
