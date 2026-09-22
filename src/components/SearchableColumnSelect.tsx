import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeHeader } from '../lib/normalizers'

type Props = {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
}

type MenuPosition = {
  left: number
  top?: number
  bottom?: number
  width: number
  maxHeight: number
}

const MAX_RENDERED_OPTIONS = 120

export default function SearchableColumnSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecionar coluna',
  ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const filteredOptions = useMemo(() => {
    const term = normalizeHeader(query)
    const matches = term
      ? options.filter(option => normalizeHeader(option).includes(term))
      : options

    return matches.slice(0, MAX_RENDERED_OPTIONS)
  }, [options, query])

  const hiddenCount = Math.max(
    0,
    (query
      ? options.filter(option => normalizeHeader(option).includes(normalizeHeader(query))).length
      : options.length) - filteredOptions.length,
  )

  const syncMenuPosition = () => {
    const root = rootRef.current
    if (!root) return

    const rect = root.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow
    const available = Math.max(150, Math.min(320, openUpward ? spaceAbove : spaceBelow))

    const width = Math.min(Math.max(260, rect.width), Math.max(180, window.innerWidth - 16))
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    )

    setMenuPosition({
      left,
      width,
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? viewportHeight - rect.top + 6 : undefined,
      maxHeight: available,
    })
  }

  useEffect(() => {
    if (!open) return

    syncMenuPosition()
    const onViewportChange = () => syncMenuPosition()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
      setActiveIndex(0)
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const close = () => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    close()
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(current => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(current => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'Tab') close()
  }

  const displayValue = open ? query : value

  const menu = open && menuPosition && createPortal(
    <div
      ref={menuRef}
      className="column-combobox-menu"
      style={{
        left: menuPosition.left,
        top: menuPosition.top,
        bottom: menuPosition.bottom,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
      }}
    >
      <div
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className="column-combobox-list"
      >
        {!query && (
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className={'column-combobox-option clear-option' + (value === '' ? ' selected' : '')}
            onMouseDown={event => event.preventDefault()}
            onClick={() => selectOption('')}
          >
            <span>Não mapeado</span>
          </button>
        )}

        {filteredOptions.map((option, index) => (
          <button
            type="button"
            role="option"
            id={listboxId + '-option-' + index}
            aria-selected={option === value}
            className={
              'column-combobox-option' +
              (index === activeIndex ? ' active' : '') +
              (option === value ? ' selected' : '')
            }
            key={option}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={event => event.preventDefault()}
            onClick={() => selectOption(option)}
            title={option}
          >
            <span>{option}</span>
            {option === value && <strong>Selecionado</strong>}
          </button>
        ))}

        {filteredOptions.length === 0 && (
          <div className="column-combobox-empty">
            Nenhuma coluna encontrada para “{query}”.
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="column-combobox-hint">
            +{hiddenCount} colunas. Digite mais caracteres para refinar.
          </div>
        )}
      </div>
    </div>,
    document.body,
  )

  return (
    <div className={'column-combobox' + (open ? ' is-open' : '')} ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filteredOptions[activeIndex]
            ? listboxId + '-option-' + activeIndex
            : undefined
        }
        autoComplete="off"
        value={displayValue}
        placeholder={open ? 'Pesquisar coluna…' : placeholder}
        onFocus={handleFocus}
        onChange={event => {
          setQuery(event.target.value)
          if (!open) setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />

      {value && !open && (
        <button
          type="button"
          className="column-combobox-clear"
          aria-label={'Limpar ' + ariaLabel.toLowerCase()}
          title="Remover vínculo"
          onMouseDown={event => event.preventDefault()}
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}

      <button
        type="button"
        className="column-combobox-chevron"
        aria-label={open ? 'Fechar opções' : 'Abrir opções'}
        tabIndex={-1}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (open) close()
          else {
            setOpen(true)
            window.requestAnimationFrame(() => inputRef.current?.focus())
          }
        }}
      >
        {open ? '▴' : '▾'}
      </button>

      {menu}
    </div>
  )
}
