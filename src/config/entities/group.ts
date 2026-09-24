import type { EntityProfile, FieldDefinition } from '../../types'

const fields: FieldDefinition[] = [
  {
    id: 'codigoSecao',
    label: 'Código da seção',
    checklistLabel: 'Código seção',
    databaseField: 'COD_SECAO',
    group: 'Grupo',
    kind: 'code',
    requiredForMatch: true,
    aliases: ['COD_SECAO'],
    originExactAliases: ['COD_SECAO'],
    targetExactAliases: ['COD_SECAO'],
  },
  {
    id: 'codigoGrupo',
    label: 'Código do grupo',
    checklistLabel: 'Código grupo',
    databaseField: 'COD_GRUPO',
    group: 'Grupo',
    kind: 'code',
    requiredForMatch: true,
    aliases: ['COD_GRUPO'],
    originExactAliases: ['COD_GRUPO'],
    targetExactAliases: ['COD_GRUPO'],
  },
  {
    id: 'descricaoGrupo',
    label: 'Descrição do grupo',
    checklistLabel: 'Descrição grupo',
    databaseField: 'DES_GRUPO',
    group: 'Grupo',
    kind: 'text',
    aliases: ['DES_GRUPO'],
    originExactAliases: ['DES_GRUPO'],
    targetExactAliases: ['DES_GRUPO'],
  },
]

export const groupProfile: EntityProfile = {
  id: 'group',
  label: 'Grupos',
  description: 'Homologação do código de seção vinculado ao código e descrição do grupo.',
  aliases: ['GRUPO', 'GRUPOS', 'GRUPO_PRODUTO'],
  fields,
  statusAliases: [],
  nameFieldId: 'descricaoGrupo',
  recordLabel: 'Grupo',
  duplicateFieldIds: ['codigoGrupo'],
  ambiguousBareTokens: [],
}
