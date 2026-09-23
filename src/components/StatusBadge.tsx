import type { Severity } from '../types'

export function statusClassName(status: string) {
  if (status === 'CONFORME' || status === 'VÁLIDO') return 'status status-ok'
  if (status === 'ATENÇÃO') return 'status status-warning'
  if (status === 'DIVERGENTE' || status === 'INVÁLIDO') return 'status status-error'
  return 'status status-neutral'
}

export default function StatusBadge({ status }: { status: Severity }) {
  return <span className={statusClassName(status)}>{status}</span>
}
