import type { EntityProfile } from '../../types'
import { CHECKLIST_FIELDS, RECORD_STATUS_ALIASES } from '../checklist'

export const clientProfile: EntityProfile = {
  id: 'client',
  label: 'Clientes',
  description: 'Cadastro de pessoas físicas e jurídicas para conversão comercial',
  aliases: ['CLIENTE', 'CLIENTES', 'CLI', 'CONSUMIDOR'],
  fields: CHECKLIST_FIELDS,
  statusAliases: RECORD_STATUS_ALIASES,
  nameFieldId: 'nome',
  recordLabel: 'Cliente',
  showDocumentValidity: true,
  duplicateFieldIds: ['cpfCnpj', 'ie'],
  ambiguousBareTokens: [
    { token: 'CONVENIO', fieldIds: ['empresaConvenio', 'conveniado', 'statusConvenio', 'limiteConvenio'] },
    { token: 'EMPRESA', fieldIds: ['pessoaTipo'] },
  ],
}
