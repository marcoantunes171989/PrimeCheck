import type { FieldDefinition } from '../types'

export const duplicateCategory = (field: FieldDefinition): string => {
  const id = field.id.toLocaleLowerCase('pt-BR')
  const label = field.label.toLocaleLowerCase('pt-BR')
  const group = field.group.toLocaleLowerCase('pt-BR')
  const identity = `${id} ${label}`

  if (
    field.kind === 'document'
    || /\b(cpf|cnpj)\b/.test(identity)
    || id === 'rg'
    || label === 'rg'
    || /\brg\b/.test(identity)
  ) {
    return 'Documento'
  }

  if (field.kind === 'ie' || id === 'ie' || /inscri[cç][aã]o estadual/.test(identity)) {
    return 'Fiscal'
  }

  if (group.includes('fiscal')) return 'Fiscal'

  if (
    field.kind === 'phone'
    || /telefone|celular|e-?mail|fax/.test(identity)
    || group.includes('contato')
  ) {
    return 'Contato'
  }

  if (/c[oó]digo de barras|cod(igo)?_?barras|\bean\b|\bgtin\b/.test(identity)) {
    return 'Produto'
  }

  if (
    /^(nome|apelido)$/.test(id)
    || /descri[cç][aã]o|fantasia|raz[aã]o social/.test(identity)
  ) {
    return 'Cadastro'
  }

  if (group.includes('identifica') || field.kind === 'code') {
    return 'Identificação'
  }

  if (group.includes('documento')) return 'Documento'
  return field.group || 'Cadastro'
}
