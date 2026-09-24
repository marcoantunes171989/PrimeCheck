import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  percent: number
  running?: boolean
  title: string
  detail?: string
  meta?: ReactNode
  compact?: boolean
  className?: string
}

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

const useSmoothPercent = (target: number) => {
  const normalizedTarget = clampPercent(target)
  const [displayed, setDisplayed] = useState(normalizedTarget)
  const displayedRef = useRef(normalizedTarget)

  useEffect(() => {
    const startValue = displayedRef.current
    const endValue = normalizedTarget

    if (endValue < startValue) {
      displayedRef.current = endValue
      setDisplayed(endValue)
      return
    }

    if (endValue === startValue) return

    const distance = endValue - startValue
    const duration = Math.min(650, Math.max(180, distance * 16))
    const startedAt = performance.now()
    let frame = 0

    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      const next = startValue + distance * eased
      displayedRef.current = next
      setDisplayed(next)

      if (elapsed < 1) {
        frame = window.requestAnimationFrame(animate)
      } else {
        displayedRef.current = endValue
        setDisplayed(endValue)
      }
    }

    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [normalizedTarget])

  return displayed
}

export default function ImportProgressBar({
  percent,
  running = false,
  title,
  detail = '',
  meta,
  compact = false,
  className = '',
}: Props) {
  const displayed = useSmoothPercent(percent)
  const rounded = Math.round(displayed)

  return (
    <section
      className={[
        'global-import-progress',
        running ? 'is-running' : 'is-complete',
        compact ? 'is-compact' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-live="polite"
    >
      <div className="global-import-progress-head">
        <div>
          <strong>{title}</strong>
          {detail && <small title={detail}>{detail}</small>}
        </div>
        <b>{rounded}%</b>
      </div>

      <div
        className="global-import-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-label={title}
      >
        <i style={{ width: displayed.toFixed(2) + '%' }} />
      </div>

      {meta && <div className="global-import-progress-meta">{meta}</div>}
    </section>
  )
}
