import type { Severity } from '../types'

export default function StatusBadge({ status }: { status: Severity }) {
  const className = status === 'CONFORME'
    ? 'status status-ok'
    : status === 'ATENÇÃO'
      ? 'status status-warning'
      : status === 'DIVERGENTE'
        ? 'status status-error'
        : 'status status-neutral'
  return <span className={className}>{status}</span>
}
