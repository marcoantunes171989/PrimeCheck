import type { EntityProfile, FieldDefinition } from '../../types'

const fields: FieldDefinition[] = [
  {
    id: 'codigoSecao',
    label: 'Código da seção',
    checklistLabel: 'Código',
    databaseField: 'COD_SECAO',
    group: 'Seção',
    kind: 'code',
    requiredForMatch: true,
    aliases: ['COD_SECAO'],
    originExactAliases: ['COD_SECAO'],
    targetExactAliases: ['COD_SECAO'],
  },
  {
    id: 'descricaoSecao',
    label: 'Descrição da seção',
    checklistLabel: 'Descrição',
    databaseField: 'DES_SECAO',
    group: 'Seção',
    kind: 'text',
    aliases: ['DES_SECAO'],
    originExactAliases: ['DES_SECAO'],
    targetExactAliases: ['DES_SECAO'],
  },
]

export const sectionProfile: EntityProfile = {
  id: 'section',
  label: 'Seções',
  description: 'Homologação de código e descrição das seções.',
  aliases: ['SECAO', 'SECAO_PRODUTO', 'SECOES'],
  fields,
  statusAliases: [],
  nameFieldId: 'descricaoSecao',
  recordLabel: 'Seção',
  duplicateFieldIds: ['codigoSecao'],
  ambiguousBareTokens: [],
}
