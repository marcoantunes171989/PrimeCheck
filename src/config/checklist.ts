import type { FieldDefinition } from '../types'

const CHECKLIST_FIELDS_BASE: FieldDefinition[] = [
  {
    id: 'codigoInterno',
    label: 'Código interno',
    group: 'Código interno',
    kind: 'code',
    requiredForMatch: true,
    aliases: [
      'COD_CLIENTE', 'CLIENTE_CODIGO', 'CODIGO_CLIENTE', 'CODIGO', 'CODCLIENTE',
      'COD_CLI', 'ID_CLIENTE', 'COD. CLIENTE', 'COD CLIENTE', 'Cod. Cliente',
    ],
  },
  {
    id: 'nome',
    label: 'Nome',
    group: 'Nome e apelido',
    kind: 'text',
    aliases: [
      'NOME', 'CLIENTE_NOME', 'DES_CLIENTE', 'NOME_CLIENTE', 'RAZAO_SOCIAL',
      'NOME_RAZAO_SOCIAL', 'DES_RAZAO_SOCIAL', 'DESCRIÇÃO DO CLIENTE',
      'DESCRICAO DO CLIENTE', 'Descrição do Cliente',
    ],
  },
  {
    id: 'apelido',
    label: 'Apelido',
    group: 'Nome e apelido',
    kind: 'text',
    aliases: [
      'APELIDO', 'NOME_FANTASIA', 'FANTASIA', 'DES_FANTASIA', 'CLIENTE_APELIDO',
    ],
  },
  {
    id: 'cpfCnpj',
    label: 'CPF/CNPJ',
    group: 'CNPJ/CPF e IE/RG',
    kind: 'document',
    aliases: [
      'CPF_CNPJ', 'CNPJ_CPF', 'CGC', 'NUM_CGC', 'CNPJ', 'CPF', 'NUM_CPF',
      'NUM_CNPJ', 'DOCUMENTO', 'CPF/CNPJ', 'CNPJ/CPF',
    ],
  },
  {
    id: 'ie',
    label: 'Inscrição Estadual',
    group: 'CNPJ/CPF e IE/RG',
    kind: 'ie',
    aliases: [
      'IE', 'I.E', 'I.E.', 'INSCRICAO_ESTADUAL', 'INSC_EST', 'NUM_INSC_EST',
      'NUM_INSCRICAO_ESTADUAL', 'CLIENTE_INSCRICAO', 'Inscrição Estadual',
    ],
  },
  {
    id: 'rg',
    label: 'RG',
    group: 'CNPJ/CPF e IE/RG',
    kind: 'text',
    aliases: ['RG', 'NUM_RG', 'REGISTRO_GERAL', 'IDENTIDADE'],
  },
  {
    id: 'pessoaTipo',
    label: 'Pessoa Física ou Jurídica',
    group: 'Pessoa Física ou Jurídica',
    kind: 'personType',
    aliases: [
      'TIPO_PESSOA', 'TIP_PESSOA', 'PESSOA_FISICA_JURIDICA', 'FISICA_JURIDICA',
      'PESSOA', 'TIPO_CLIENTE', 'FLG_EMPRESA', 'EMPRESA', 'FLAG_EMPRESA_CONÊNIO', 'FLAG_EMPRESA_CONVENIO',
    ],
  },
  {
    id: 'limiteCheque',
    label: 'Limite Cheque',
    group: 'Limite de Crédito de Cheque e Convênio',
    kind: 'money',
    aliases: [
      'LIMITE_CHEQUE', 'VLR_LIMITE_CHEQUE', 'VALOR_LIMITE_CHEQUE',
      'VAL_LIMITE_CRETID', 'VAL_LIMITE_CREDITO', 'Limite Cheque',
    ],
  },
  {
    id: 'limiteConvenio',
    label: 'Limite Convênio',
    group: 'Limite de Crédito de Cheque e Convênio',
    kind: 'money',
    aliases: [
      'LIMITE_CONVENIO', 'VLR_LIMITE_CONVENIO', 'VALOR_LIMITE_CONVENIO',
      'VAL_LIMITE_CONV', 'Limite Convênio', 'Limite Convenio',
    ],
  },
  {
    id: 'dataCadastro',
    label: 'Data de Cadastro',
    group: 'Data de Cadastro',
    kind: 'date',
    aliases: [
      'DATA_CADASTRO', 'DTA_CADASTRO', 'DAT_CADASTRO', 'DT_CADASTRO',
      'DATA_INCLUSAO', 'DTA_INCLUSAO', 'DATA. CADASTRO.', 'Data. Cadastro.',
    ],
  },
  {
    id: 'endereco',
    label: 'Endereço',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'text',
    aliases: ['ENDERECO', 'DES_ENDERECO', 'LOGRADOURO', 'ENDERECO_RESIDENCIAL', 'Endereço'],
  },
  {
    id: 'numeroEndereco',
    label: 'Nº Endereço',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'text',
    aliases: [
      'NUMERO', 'NUM_ENDERECO', 'NUMERO_ENDERECO', 'NRO_ENDERECO',
      'ENDERECO_NUMERO', 'ENDERECO__2', 'Nº ENDEREÇO', 'N° ENDEREÇO', 'Nº Endereço',
    ],
  },
  {
    id: 'complemento',
    label: 'Complemento',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'text',
    aliases: ['COMPLEMENTO', 'DES_COMPLEMENTO', 'COMPL_ENDERECO'],
  },
  {
    id: 'bairro',
    label: 'Bairro',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'text',
    aliases: ['BAIRRO', 'DES_BAIRRO'],
  },
  {
    id: 'cidade',
    label: 'Cidade',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'text',
    aliases: ['CIDADE', 'DES_CIDADE', 'MUNICIPIO', 'DES_MUNICIPIO'],
  },
  {
    id: 'uf',
    label: 'UF',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'state',
    aliases: ['UF', 'ESTADO', 'SIGLA_UF', 'DES_UF', 'DES_SIGLA'],
  },
  {
    id: 'cep',
    label: 'CEP',
    group: 'Endereço Completo (CEP, Bairro, Cidade, Estado, Etc...)',
    kind: 'code',
    aliases: ['CEP', 'NUM_CEP', 'COD_CEP'],
  },
  {
    id: 'telefone',
    label: 'Telefone',
    group: 'Telefone, Celular, Fax e Contato',
    kind: 'phone',
    aliases: ['TELEFONE', 'FONE', 'NUM_TELEFONE', 'NUMERO_TELEFONE', 'TEL', 'FONE1', 'NUM_FONE'],
  },
  {
    id: 'celular',
    label: 'Celular',
    group: 'Telefone, Celular, Fax e Contato',
    kind: 'phone',
    aliases: ['CELULAR', 'NUM_CELULAR', 'NUMERO_CELULAR__2', 'NUMERO_CELULAR', 'FONE_CELULAR', 'TELEFONE_CELULAR', 'WHATSAPP'],
  },
  {
    id: 'fax',
    label: 'Fax',
    group: 'Telefone, Celular, Fax e Contato',
    kind: 'phone',
    aliases: ['FAX', 'NUM_FAX'],
  },
  {
    id: 'contato',
    label: 'Contato',
    group: 'Telefone, Celular, Fax e Contato',
    kind: 'text',
    aliases: ['CONTATO', 'NOME_CONTATO', 'DES_CONTATO'],
  },
  {
    id: 'dataNascimento',
    label: 'Data de Nascimento',
    group: 'Data de Nascimento',
    kind: 'date',
    aliases: [
      'DATA_NASCIMENTO', 'DTA_NASCIMENTO', 'DAT_NASCIMENTO', 'DT_NASCIMENTO',
      'NASCIMENTO', 'DATA NASCIMENTO.', 'Data Nascimento.',
    ],
  },
  {
    id: 'sexo',
    label: 'Sexo',
    group: 'Sexo Masculino ou Feminino',
    kind: 'sex',
    aliases: ['SEXO', 'GENERO', 'FLG_SEXO'],
  },
  {
    id: 'estadoCivil',
    label: 'Estado Civil',
    group: 'Estado Civil',
    kind: 'text',
    aliases: ['ESTADO_CIVIL', 'EST_CIVIL', 'DES_ESTADO_CIVIL', 'FLG_EST_CIVIL'],
  },
  {
    id: 'statusCheque',
    label: 'Status Cheque',
    group: 'Status PDV (Cheque e Convênio)',
    kind: 'text',
    aliases: ['STATUS_CHEQUE', 'SIT_CHEQUE', 'SITUACAO_CHEQUE', 'COD_STATUS_PDV'],
  },
  {
    id: 'statusConvenio',
    label: 'Status Convênio',
    group: 'Status PDV (Cheque e Convênio)',
    kind: 'text',
    aliases: [
      'STATUS_CONVENIO', 'SIT_CONVENIO', 'SITUACAO_CONVENIO',
      'COD_STATUS_PDV_CONV', 'STATUS_PDV__2', 'Status Convenio',
    ],
  },
  {
    id: 'empresaConvenio',
    label: 'Empresa Convênio',
    group: 'Empresa Convênio e Dia de Fechamento',
    kind: 'text',
    aliases: [
      'EMPRESA_CONVENIO', 'COD_EMPRESA_CONVENIO', 'DES_EMPRESA_CONVENIO',
      'COD_CONVENIO', 'CODIGO_CONVÊNIO', 'CODIGO_CONVENIO', 'CONVENIO', 'Convênio', 'Convenio',
    ],
  },
  {
    id: 'diaFechamento',
    label: 'Dia de Fechamento',
    group: 'Empresa Convênio e Dia de Fechamento',
    kind: 'code',
    aliases: ['DIA_FECHAMENTO', 'DIA_FECHA', 'DIA_FATURAMENTO', 'Dia Fechamento'],
  },
  {
    id: 'conveniado',
    label: 'Conveniado',
    group: 'Conveniado',
    kind: 'boolean',
    aliases: ['CONVENIADO', 'FLG_CONVENIADO', 'IND_CONVENIADO', 'FLG_CONVENIO', 'CONVÊNIO', 'CONVENIO'],
  },
  {
    id: 'condicaoPagamento',
    label: 'Condição de Pagamento',
    group: 'Condição de Pagamento',
    kind: 'text',
    aliases: [
      'CONDICAO_PAGAMENTO', 'COND_PAGAMENTO', 'COD_CONDICAO_PAGAMENTO',
      'DES_CONDICAO_PAGAMENTO', 'CONDICAO', 'Condição', 'Condicao',
    ],
  },
  {
    id: 'observacao',
    label: 'Observação',
    group: 'Observação',
    kind: 'text',
    aliases: ['OBSERVACAO', 'OBS', 'DES_OBSERVACAO', 'COMENTARIO', 'ANOTACAO', 'Observação'],
  },
]

const CLIENT_CHECKLIST_CONFIG: Record<string, {
  checklistLabel: string
  databaseField: string
  aliases: string[]
}> = {
  codigoInterno: {
    checklistLabel: 'Código interno',
    databaseField: 'COD_CLIENTE',
    aliases: ['COD_CLIENTE'],
  },
  nome: {
    checklistLabel: 'Nome',
    databaseField: 'DES_CLIENTE',
    aliases: ['DES_CLIENTE'],
  },
  apelido: {
    checklistLabel: 'Apelido',
    databaseField: 'DES_FANTASIA',
    aliases: ['DES_FANTASIA'],
  },
  cpfCnpj: {
    checklistLabel: 'CNPJ/CPF',
    databaseField: 'NUM_CGC',
    aliases: ['NUM_CGC'],
  },
  ie: {
    checklistLabel: 'IE',
    databaseField: 'NUM_INSC_EST',
    aliases: ['NUM_INSC_EST'],
  },
  rg: {
    checklistLabel: 'RG',
    databaseField: 'NUM_RG',
    aliases: ['NUM_RG'],
  },
  pessoaTipo: {
    checklistLabel: 'Pessoa Física ou Jurídica',
    databaseField: 'FLG_EMPRESA',
    aliases: ['FLG_EMPRESA'],
  },
  limiteConvenio: {
    checklistLabel: 'Limite de convênio',
    databaseField: 'VAL_LIMITE_CONV',
    aliases: ['VAL_LIMITE_CONV'],
  },
  limiteCheque: {
    checklistLabel: 'Limite de cheque',
    databaseField: 'VAL_LIMITE_CREDITO',
    aliases: ['VAL_LIMITE_CREDITO'],
  },
  dataCadastro: {
    checklistLabel: 'Data de cadastro',
    databaseField: 'DTA_CADASTRO',
    aliases: ['DTA_CADASTRO'],
  },
  endereco: {
    checklistLabel: 'Endereço',
    databaseField: 'DES_ENDERECO',
    aliases: ['DES_ENDERECO'],
  },
  numeroEndereco: {
    checklistLabel: 'Número',
    databaseField: 'NUM_ENDERECO',
    aliases: ['NUM_ENDERECO'],
  },
  complemento: {
    checklistLabel: 'Complemento',
    databaseField: 'DES_COMPLEMENTO',
    aliases: ['DES_COMPLEMENTO'],
  },
  bairro: {
    checklistLabel: 'Bairro',
    databaseField: 'DES_BAIRRO',
    aliases: ['DES_BAIRRO'],
  },
  cidade: {
    checklistLabel: 'Cidade',
    databaseField: 'DES_CIDADE',
    aliases: ['DES_CIDADE'],
  },
  uf: {
    checklistLabel: 'Sigla',
    databaseField: 'DES_SIGLA',
    aliases: ['DES_SIGLA'],
  },
  cep: {
    checklistLabel: 'CEP',
    databaseField: 'NUM_CEP',
    aliases: ['NUM_CEP'],
  },
  telefone: {
    checklistLabel: 'Telefone',
    databaseField: 'NUM_FONE',
    aliases: ['NUM_FONE'],
  },
  celular: {
    checklistLabel: 'Celular',
    databaseField: 'NUM_CELULAR',
    aliases: ['NUM_CELULAR'],
  },
  fax: {
    checklistLabel: 'Fax',
    databaseField: 'NUM_FAX',
    aliases: ['NUM_FAX'],
  },
  contato: {
    checklistLabel: 'Contato',
    databaseField: 'DES_CONTATO',
    aliases: ['DES_CONTATO'],
  },
  dataNascimento: {
    checklistLabel: 'Data de nascimento',
    databaseField: 'DTA_NASCIMENTO',
    aliases: ['DTA_NASCIMENTO'],
  },
  sexo: {
    checklistLabel: 'Sexo Masculino ou Feminino',
    databaseField: 'FLG_SEXO',
    aliases: ['FLG_SEXO'],
  },
  estadoCivil: {
    checklistLabel: 'Estado civil',
    databaseField: 'FLG_EST_CIVIL',
    aliases: ['FLG_EST_CIVIL'],
  },
  statusCheque: {
    checklistLabel: 'Status PDV',
    databaseField: 'cod_status_pdv',
    aliases: ['COD_STATUS_PDV'],
  },
  statusConvenio: {
    checklistLabel: 'Status PDV convênio',
    databaseField: 'COD_STATUS_PDV_CONV',
    aliases: ['COD_STATUS_PDV_CONV'],
  },
  empresaConvenio: {
    checklistLabel: 'Código convênio',
    databaseField: 'cod_convenio',
    aliases: ['COD_CONVENIO'],
  },
  diaFechamento: {
    checklistLabel: 'Dia de Fechamento convênio',
    databaseField: 'NUM_DIA_FECHA',
    aliases: ['NUM_DIA_FECHA'],
  },
  conveniado: {
    checklistLabel: 'Convênio',
    databaseField: 'flg_convenio',
    aliases: ['FLG_CONVENIO'],
  },
  observacao: {
    checklistLabel: 'Observação',
    databaseField: 'DES_OBSERVACAO',
    aliases: ['DES_OBSERVACAO', 'OBSERVACAO'],
  },
}

const CLIENT_CHECKLIST_ORDER = [
  'codigoInterno',
  'nome',
  'apelido',
  'cpfCnpj',
  'ie',
  'rg',
  'pessoaTipo',
  'limiteConvenio',
  'limiteCheque',
  'dataCadastro',
  'endereco',
  'numeroEndereco',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'cep',
  'telefone',
  'celular',
  'fax',
  'contato',
  'dataNascimento',
  'sexo',
  'estadoCivil',
  'statusCheque',
  'statusConvenio',
  'empresaConvenio',
  'diaFechamento',
  'conveniado',
  'observacao',
]

const CLIENT_CHECKLIST_ORDER_INDEX = new Map(
  CLIENT_CHECKLIST_ORDER.map((fieldId, index) => [fieldId, index]),
)

export const CHECKLIST_FIELDS: FieldDefinition[] = CHECKLIST_FIELDS_BASE
  .filter(field => field.id !== 'condicaoPagamento')
  .map(field => {
    const config = CLIENT_CHECKLIST_CONFIG[field.id]
    return config
      ? {
          ...field,
          checklistLabel: config.checklistLabel,
          databaseField: config.databaseField,
          aliases: config.aliases,
        }
      : field
  })
  .sort((left, right) =>
    (CLIENT_CHECKLIST_ORDER_INDEX.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (CLIENT_CHECKLIST_ORDER_INDEX.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )

export const RECORD_STATUS_ALIASES = [
  'INATIVO', 'FLG_INATIVO', 'IND_INATIVO', 'ATIVO', 'FLG_ATIVO',
  'STATUS', 'SITUACAO', 'FLG_INATIVO_CLIENTE',
]
