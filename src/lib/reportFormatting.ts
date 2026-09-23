export const formatReportDateTime = (value?: string | number | Date) => {
  const source = value ?? new Date()
  const parsed = source instanceof Date ? source : new Date(source)
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const datePart = date.toLocaleDateString('pt-BR')
  const timePart = date.toLocaleTimeString('pt-BR')
  return `${datePart} | ${timePart}`
}
