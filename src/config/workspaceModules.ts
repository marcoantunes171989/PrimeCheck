import { clientProfile } from './entities/client'
import { supplierProfile } from './entities/supplier'
import { productProfile } from './entities/product'
import { sectionProfile } from './entities/section'
import { groupProfile } from './entities/group'
import { subgroupProfile } from './entities/subgroup'
import { normalizeHeader } from '../lib/normalizers'
import type { EntityProfile, FieldDefinition, ImportedFile } from '../types'

export type WorkspaceModuleId =
  | 'clients'
  | 'suppliers'
  | 'carriers'
  | 'sections'
  | 'groups'
  | 'subgroups'
  | 'products'
  | 'productStore'
  | 'barcodes'
  | 'productSupplier'
  | 'similarProducts'
  | 'ncm'
  | 'cest'
  | 'ibpt'
  | 'ibscbs'
  | 'taxBenefit'
  | 'recipes'
  | 'nutrition'

export type WorkspaceGroupId = 'partners' | 'structure' | 'products' | 'fiscal'

export interface WorkspaceField {
  id: string
  label: string
  aliases: string[]
}

export interface WorkspaceModuleDefinition {
  id: WorkspaceModuleId
  label: string
  singular: string
  group: WorkspaceGroupId
  description: string
  signals: string[]
  fields: WorkspaceField[]
}

export interface WorkspaceModuleMatch {
  module: WorkspaceModuleDefinition
  fileIds: string[]
  fileNames: string[]
  rowCount: number
  matchedFields: WorkspaceField[]
  headers: string[]
  confidence: number
}

const fromProfile = (fields: typeof clientProfile.fields): WorkspaceField[] =>
  fields.map(field => ({
    id: field.id,
    label: field.label,
    aliases: [field.label, ...field.aliases],
  }))

const field = (id: string, label: string, aliases: string[]): WorkspaceField => ({
  id,
  label,
  aliases: [label, ...aliases],
})

const clientFields = fromProfile(clientProfile.fields)
const supplierFields = fromProfile(supplierProfile.fields)

const carrierFields: WorkspaceField[] = [
  field('codigoInterno', 'Código interno', ['COD_TRANSPORTADORA', 'COD_TRANSP', 'CODIGO_TRANSPORTADORA', 'ID_TRANSPORTADORA']),
  field('nome', 'Razão Social', ['RAZAO_SOCIAL', 'DES_TRANSPORTADORA', 'NOME_TRANSPORTADORA', 'TRANSPORTADORA']),
  field('cpfCnpj', 'CPF/CNPJ', ['CNPJ', 'CPF', 'NUM_CGC', 'CPF_CNPJ', 'CNPJ_CPF']),
  field('ie', 'Inscrição Estadual', ['IE', 'NUM_INSC_EST', 'INSCRICAO_ESTADUAL']),
  field('endereco', 'Endereço', ['ENDERECO', 'DES_ENDERECO', 'LOGRADOURO']),
  field('numero', 'Número', ['NUM_ENDERECO', 'NUMERO_ENDERECO', 'NUMERO']),
  field('bairro', 'Bairro', ['BAIRRO', 'DES_BAIRRO']),
  field('cidade', 'Cidade', ['CIDADE', 'DES_CIDADE', 'MUNICIPIO']),
  field('uf', 'UF', ['UF', 'ESTADO', 'SIGLA_UF']),
  field('cep', 'CEP', ['CEP', 'NUM_CEP']),
  field('telefone', 'Telefone', ['TELEFONE', 'FONE', 'NUM_FONE']),
  field('fax', 'Fax', ['FAX', 'NUM_FAX']),
  field('contato', 'Contato', ['CONTATO', 'NOME_CONTATO']),
  field('email', 'E-mail', ['EMAIL', 'E_MAIL', 'DES_EMAIL']),
  field('website', 'Website', ['WEBSITE', 'SITE', 'URL_SITE']),
  field('observacao', 'Observação', ['OBSERVACAO', 'OBS', 'DES_OBSERVACAO']),
]

const productBaseFields = fromProfile(productProfile.fields)

const modules: WorkspaceModuleDefinition[] = [
  {
    id: 'clients',
    label: 'Clientes',
    singular: 'Cliente',
    group: 'partners',
    description: 'Cadastro de clientes, documentos, endereço, contato, limites, convênio e condições.',
    signals: ['COD_CLIENTE', 'DES_CLIENTE', 'CLIENTE_CODIGO', 'NUM_CGC', 'FLG_CONVENIO'],
    fields: clientFields,
  },
  {
    id: 'suppliers',
    label: 'Fornecedores',
    singular: 'Fornecedor',
    group: 'partners',
    description: 'Cadastro de fornecedores, razão social, fantasia, documentos, contato e condição de pagamento.',
    signals: ['COD_FORNECEDOR', 'DES_FORNECEDOR', 'FORNECEDOR_CODIGO', 'NOME_FORNECEDOR'],
    fields: supplierFields,
  },
  {
    id: 'carriers',
    label: 'Transportadoras',
    singular: 'Transportadora',
    group: 'partners',
    description: 'Cadastro de transportadoras, documentos, endereço, contato, e-mail e website.',
    signals: ['COD_TRANSPORTADORA', 'DES_TRANSPORTADORA', 'TRANSPORTADORA', 'COD_TRANSP'],
    fields: carrierFields,
  },
  {
    id: 'sections',
    label: 'Seções',
    singular: 'Seção',
    group: 'structure',
    description: 'Estrutura mercadológica de seções de produtos.',
    signals: ['COD_SECAO', 'DES_SECAO', 'SECAO'],
    fields: [
      field('codigoSecao', 'Código seção', ['COD_SECAO', 'CODIGO_SECAO', 'ID_SECAO', 'CODIGO']),
      field('descricaoSecao', 'Descrição seção', ['DES_SECAO', 'DESCRICAO_SECAO', 'SECAO', 'DESCRICAO']),
    ],
  },
  {
    id: 'groups',
    label: 'Grupos',
    singular: 'Grupo',
    group: 'structure',
    description: 'Grupos vinculados à estrutura mercadológica.',
    signals: ['COD_GRUPO', 'DES_GRUPO', 'GRUPO_PRODUTO'],
    fields: [
      field('codigoSecao', 'Código seção', ['COD_SECAO', 'CODIGO_SECAO']),
      field('codigoGrupo', 'Código grupo', ['COD_GRUPO', 'CODIGO_GRUPO', 'ID_GRUPO']),
      field('descricaoGrupo', 'Descrição grupo', ['DES_GRUPO', 'DESCRICAO_GRUPO', 'GRUPO_PRODUTO']),
    ],
  },
  {
    id: 'subgroups',
    label: 'Subgrupos',
    singular: 'Subgrupo',
    group: 'structure',
    description: 'Subgrupos vinculados a seção e grupo.',
    signals: ['COD_SUBGRUPO', 'DES_SUBGRUPO', 'SUBGRUPO', 'SUB_GRUPO'],
    fields: [
      field('codigoSecao', 'Código seção', ['COD_SECAO', 'CODIGO_SECAO']),
      field('codigoGrupo', 'Código grupo', ['COD_GRUPO', 'CODIGO_GRUPO']),
      field('codigoSubgrupo', 'Código subgrupo', ['COD_SUBGRUPO', 'CODIGO_SUBGRUPO', 'ID_SUBGRUPO']),
      field('descricaoSubgrupo', 'Descrição subgrupo', ['DES_SUBGRUPO', 'DESCRICAO_SUBGRUPO', 'SUBGRUPO', 'SUB_GRUPO']),
    ],
  },
  {
    id: 'products',
    label: 'Cadastro Base do Produto',
    singular: 'Produto',
    group: 'products',
    description: 'Cadastro-base do produto. Serve de referência para Produto por Loja, códigos de barras, fornecedores, similares e demais vínculos.',
    signals: ['COD_PRODUTO', 'DES_PRODUTO', 'COD_BARRA_PRINCIPAL', 'DES_REDUZIDA'],
    fields: [
      ...productBaseFields,
      field('plu', 'Código PLU', ['PLU', 'COD_PLU', 'CODIGO_PLU']),
      field('embalagemCompra', 'Embalagem de compra', ['EMBALAGEM_COMPRA', 'QTD_EMBALAGEM_COMPRA', 'UND_COMPRA']),
      field('embalagemVenda', 'Embalagem de venda', ['EMBALAGEM_VENDA', 'QTD_EMBALAGEM_VENDA', 'UND_VENDA']),
      field('tributacaoEntrada', 'Tributação de entrada', ['TRIBUTACAO_ENTRADA', 'TRIB_ENTRADA']),
      field('tributacaoSaida', 'Tributação de saída', ['TRIBUTACAO_SAIDA', 'TRIB_SAIDA']),
      field('codigoPai', 'Código associado / Pai', ['COD_PRODUTO_PAI', 'COD_PAI', 'PRODUTO_PAI']),
      field('codigoFilho', 'Código associado / Filho', ['COD_PRODUTO_FILHO', 'COD_FILHO', 'PRODUTO_FILHO']),
      field('bebidaAlcoolica', 'Bebida alcoólica', ['BEBIDA_ALCOOLICA', 'FLG_BEBIDA_ALCOOLICA']),
      field('foraLinha', 'Fora de linha', ['FORA_LINHA', 'FLG_FORA_LINHA']),
      field('foraMix', 'Fora do mix', ['FORA_MIX', 'FLG_FORA_MIX']),
      field('diasValidade', 'Dias de validade', ['DIAS_VALIDADE', 'QTD_DIAS_VALIDADE']),
      field('enviaPdv', 'Envia para PDV', ['ENVIA_PDV', 'FLG_ENVIA_PDV']),
      field('vasilhame', 'Vasilhame', ['VASILHAME', 'FLG_VASILHAME']),
      field('composicao', 'Composição / Decomposição', ['COMPOSICAO', 'DECOMPOSICAO', 'EXPLODE_COMPRA', 'EXPLODE_VENDA']),
      field('oferta', 'Oferta', ['OFERTA', 'PRECO_OFERTA', 'VLR_OFERTA']),
      field('margem', 'Margem', ['MARGEM', 'PERC_MARGEM']),
    ],
  },
  {
    id: 'productStore',
    label: 'Produto por Loja',
    singular: 'Produto por Loja',
    group: 'products',
    description: 'Módulo principal de produtos por estabelecimento. Centraliza preço, custo, estoque, oferta, margem, situação e os vínculos de análise do produto.',
    signals: ['COD_LOJA', 'PRODUTO_LOJA', 'TAB_PRODUTO_LOJA', 'PRECO_LOJA'],
    fields: [
      field('codigoLoja', 'Loja', ['COD_LOJA', 'CODIGO_LOJA', 'LOJA']),
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('precoVenda', 'Preço venda', ['PRECO_VENDA', 'VLR_VENDA', 'VALOR_VENDA']),
      field('custo', 'Custo', ['CUSTO', 'VLR_CUSTO', 'PRECO_CUSTO']),
      field('oferta', 'Oferta', ['OFERTA', 'PRECO_OFERTA', 'VLR_OFERTA']),
      field('estoque', 'Estoque', ['ESTOQUE', 'QTD_ESTOQUE', 'SALDO']),
      field('margem', 'Margem', ['MARGEM', 'PERC_MARGEM']),
      field('inativo', 'Inativo', ['INATIVO', 'FLG_INATIVO', 'STATUS']),
    ],
  },
  {
    id: 'barcodes',
    label: 'Códigos de Barras',
    singular: 'Código de Barras',
    group: 'products',
    description: 'Códigos EAN/GTIN vinculados ao produto, com suporte futuro a múltiplos códigos, duplicidades e análises por loja.',
    signals: ['COD_BARRA', 'COD_BARRA_PRINCIPAL', 'CODIGO_BARRAS', 'EAN', 'GTIN'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('codigoBarras', 'Código de barras', ['COD_BARRA', 'COD_BARRA_PRINCIPAL', 'CODIGO_BARRAS', 'EAN', 'GTIN']),
      field('principal', 'Principal', ['PRINCIPAL', 'FLG_PRINCIPAL', 'COD_BARRA_PRINCIPAL']),
    ],
  },
  {
    id: 'productSupplier',
    label: 'Produto por Fornecedor',
    singular: 'Produto por Fornecedor',
    group: 'products',
    description: 'Relacionamento independente entre produto e fornecedor, permitindo validar referências, custos e vínculos de fornecedores.',
    signals: ['PRODUTO_FORNECEDOR', 'COD_FORNECEDOR_PRODUTO', 'COD_FORNECEDOR', 'REFERENCIA_FORNECEDOR'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('codigoFornecedor', 'Código fornecedor', ['COD_FORNECEDOR', 'CODIGO_FORNECEDOR']),
      field('fornecedor', 'Fornecedor', ['DES_FORNECEDOR', 'NOME_FORNECEDOR', 'FORNECEDOR']),
      field('referencia', 'Referência fornecedor', ['REFERENCIA_FORNECEDOR', 'COD_REF_FORNECEDOR', 'REF_FORNECEDOR']),
      field('custo', 'Custo', ['CUSTO', 'VLR_CUSTO', 'PRECO_CUSTO']),
    ],
  },
  {
    id: 'similarProducts',
    label: 'Produtos Similares',
    singular: 'Produto Similar',
    group: 'products',
    description: 'Cadastro e vínculos de produtos similares/substitutos, preparado para posterior associação ao Produto por Loja.',
    signals: ['PRODUTO_SIMILAR', 'COD_PRODUTO_SIMILAR', 'SIMILAR'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('codigoSimilar', 'Código produto similar', ['COD_PRODUTO_SIMILAR', 'COD_SIMILAR', 'PRODUTO_SIMILAR']),
      field('descricaoSimilar', 'Descrição similar', ['DES_PRODUTO_SIMILAR', 'DES_SIMILAR']),
    ],
  },
  {
    id: 'ncm',
    label: 'NCM',
    singular: 'NCM',
    group: 'fiscal',
    description: 'Cadastro de referência NCM, utilizado posteriormente nos vínculos fiscais do Produto por Loja.',
    signals: ['NCM', 'COD_NCM'],
    fields: [
      field('ncm', 'NCM', ['NCM', 'COD_NCM']),
      field('descricao', 'Descrição', ['DES_NCM', 'DESCRICAO_NCM']),
      field('ex', 'EX', ['EX_TIPI', 'EX']),
    ],
  },
  {
    id: 'cest',
    label: 'CEST',
    singular: 'CEST',
    group: 'fiscal',
    description: 'Cadastro de referência CEST, relacionado ao NCM e utilizado nos vínculos fiscais do Produto por Loja.',
    signals: ['CEST', 'COD_CEST'],
    fields: [
      field('cest', 'CEST', ['CEST', 'COD_CEST']),
      field('ncm', 'NCM', ['NCM', 'COD_NCM']),
      field('descricao', 'Descrição', ['DES_CEST', 'DESCRICAO_CEST']),
    ],
  },
  {
    id: 'ibpt',
    label: 'IBPT',
    singular: 'IBPT',
    group: 'fiscal',
    description: 'Carga tributária aproximada e dados da tabela IBPT.',
    signals: ['IBPT', 'ALIQUOTA_NACIONAL', 'ALIQ_NACIONAL', 'CHAVE_IBPT'],
    fields: [
      field('ncm', 'NCM', ['NCM', 'COD_NCM']),
      field('aliqNacional', 'Alíquota nacional', ['ALIQUOTA_NACIONAL', 'ALIQ_NACIONAL']),
      field('aliqImportado', 'Alíquota importado', ['ALIQUOTA_IMPORTADO', 'ALIQ_IMPORTADO']),
      field('aliqEstadual', 'Alíquota estadual', ['ALIQUOTA_ESTADUAL', 'ALIQ_ESTADUAL']),
      field('aliqMunicipal', 'Alíquota municipal', ['ALIQUOTA_MUNICIPAL', 'ALIQ_MUNICIPAL']),
      field('chave', 'Chave IBPT', ['CHAVE_IBPT', 'IBPT_CHAVE']),
    ],
  },
  {
    id: 'ibscbs',
    label: 'IBS/CBS',
    singular: 'IBS/CBS',
    group: 'fiscal',
    description: 'Classificação e parâmetros relacionados a IBS/CBS.',
    signals: ['IBS', 'CBS', 'IBS_CBS', 'CST_IBS_CBS'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('cst', 'CST IBS/CBS', ['CST_IBS_CBS', 'CST_IBS', 'CST_CBS']),
      field('ibs', 'IBS', ['IBS', 'ALIQUOTA_IBS', 'PERC_IBS']),
      field('cbs', 'CBS', ['CBS', 'ALIQUOTA_CBS', 'PERC_CBS']),
      field('classificacao', 'Classificação tributária', ['CLASSIFICACAO_TRIBUTARIA', 'CLASS_TRIBUTARIA']),
    ],
  },
  {
    id: 'taxBenefit',
    label: 'Benefício Fiscal',
    singular: 'Benefício Fiscal',
    group: 'fiscal',
    description: 'Cadastro de benefícios fiscais e vínculos com NCM/produto, preparado para associação ao Produto por Loja.',
    signals: ['BENEFICIO_FISCAL', 'COD_BENEFICIO', 'CBENEF'],
    fields: [
      field('codigo', 'Código benefício', ['COD_BENEFICIO', 'CODIGO_BENEFICIO', 'CBENEF']),
      field('descricao', 'Descrição', ['DES_BENEFICIO', 'DESCRICAO_BENEFICIO', 'BENEFICIO_FISCAL']),
      field('uf', 'UF', ['UF', 'ESTADO']),
      field('ncm', 'NCM', ['NCM', 'COD_NCM']),
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
    ],
  },
  {
    id: 'recipes',
    label: 'Receitas',
    singular: 'Receita',
    group: 'fiscal',
    description: 'Receitas, composição e ficha técnica vinculáveis ao Produto por Loja.',
    signals: ['RECEITA', 'FICHA_TECNICA', 'INGREDIENTE', 'COMPOSICAO_PRODUTO'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('codigoReceita', 'Código receita', ['COD_RECEITA', 'ID_RECEITA']),
      field('descricao', 'Descrição receita', ['DES_RECEITA', 'RECEITA', 'FICHA_TECNICA']),
      field('ingrediente', 'Ingrediente', ['INGREDIENTE', 'DES_INGREDIENTE']),
      field('quantidade', 'Quantidade', ['QTD_INGREDIENTE', 'QUANTIDADE']),
      field('unidade', 'Unidade', ['UNIDADE', 'UND']),
    ],
  },
  {
    id: 'nutrition',
    label: 'Informações Nutricionais',
    singular: 'Informação Nutricional',
    group: 'fiscal',
    description: 'Informações nutricionais vinculáveis ao Produto por Loja.',
    signals: ['NUTRICIONAL', 'CALORIAS', 'VALOR_ENERGETICO', 'PROTEINA', 'CARBOIDRATO'],
    fields: [
      field('codigoProduto', 'Código produto', ['COD_PRODUTO', 'CODIGO_PRODUTO']),
      field('valorEnergetico', 'Valor energético', ['VALOR_ENERGETICO', 'CALORIAS']),
      field('carboidrato', 'Carboidratos', ['CARBOIDRATO', 'CARBOIDRATOS']),
      field('proteina', 'Proteínas', ['PROTEINA', 'PROTEINAS']),
      field('gorduraTotal', 'Gorduras totais', ['GORDURA_TOTAL', 'GORDURAS_TOTAIS']),
      field('gorduraSaturada', 'Gorduras saturadas', ['GORDURA_SATURADA', 'GORDURAS_SATURADAS']),
      field('fibra', 'Fibra alimentar', ['FIBRA', 'FIBRA_ALIMENTAR']),
      field('sodio', 'Sódio', ['SODIO']),
      field('porcao', 'Porção', ['PORCAO', 'QTD_PORCAO']),
    ],
  },
]

export const WORKSPACE_MODULES = modules

export const WORKSPACE_GROUPS: Array<{ id: WorkspaceGroupId; label: string; modules: WorkspaceModuleId[] }> = [
  { id: 'partners', label: 'Parceiros', modules: ['clients', 'suppliers', 'carriers'] },
  { id: 'structure', label: 'Classificação Mercadológica', modules: ['sections', 'groups', 'subgroups'] },
  {
    id: 'products',
    label: 'Produto por Loja',
    modules: ['productStore', 'products', 'barcodes', 'similarProducts', 'productSupplier'],
  },
  { id: 'fiscal', label: 'Fiscal e Conteúdo', modules: ['ncm', 'cest', 'ibpt', 'ibscbs', 'taxBenefit', 'recipes', 'nutrition'] },
]

export const PRODUCT_STORE_ARCHITECTURE = {
  primaryModule: 'productStore' as const,
  baseModule: 'products' as const,
  relationshipModules: ['barcodes', 'similarProducts', 'productSupplier'] as const,
  fiscalReferenceModules: ['ncm', 'cest', 'ibpt', 'ibscbs', 'taxBenefit'] as const,
  contentModules: ['recipes', 'nutrition'] as const,
  plannedViews: [
    'Visão Geral',
    'Homologação',
    'Produtos por Loja',
    'Códigos de Barras',
    'Custos e Preços',
    'Fiscal',
    'Produtos Similares',
    'Produto por Fornecedor',
    'Receitas',
    'Informações Nutricionais',
    'Auditorias',
  ] as const,
}



/**
 * Regra de escopo por nome do arquivo.
 *
 * Quando o nome identifica explicitamente um módulo, o arquivo fica exclusivo
 * desse módulo e não pode ser reaproveitado por detecção de cabeçalhos em outro.
 *
 * Ex.: CLIENTE_donaire.csv e cliente_intersolid.csv pertencem somente a Clientes,
 * mesmo que contenham colunas genéricas que também existam em Fornecedores,
 * Transportadoras ou outros cadastros.
 *
 * Arquivos sem prefixo conhecido continuam usando a análise estrutural existente.
 */
export const getExclusiveWorkspaceModuleFromFileName = (fileName: string): WorkspaceModuleId | null => {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const token = normalizeHeader(stem)

  if (token === 'CLIENTE' || token.startsWith('CLIENTE_')) return 'clients'
  if (token === 'FORNECEDOR' || token.startsWith('FORNECEDOR_')) return 'suppliers'
  if (token === 'SECAO' || token.startsWith('SECAO_')) return 'sections'
  if (token === 'GRUPO' || token.startsWith('GRUPO_')) return 'groups'
  if (token === 'SUBGRUPO' || token.startsWith('SUBGRUPO_')) return 'subgroups'

  return null
}

const normalized = (values: string[]) => values.map(normalizeHeader).filter(Boolean)

const headerMatches = (header: string, aliases: string[]) => {
  const source = normalizeHeader(header)
  if (!source) return false
  return normalized(aliases).some(alias =>
    source === alias ||
    (alias.length >= 5 && source.includes(alias)) ||
    (source.length >= 5 && alias.includes(source)),
  )
}

const hasAnyHeader = (file: ImportedFile, aliases: string[]) =>
  file.headers.some(header => headerMatches(header, aliases))

const hasExactHeader = (file: ImportedFile, aliases: string[]) => {
  const expected = new Set(normalized(aliases))
  return file.headers.some(header => expected.has(normalizeHeader(header)))
}

export type WorkspaceComparisonFileRole = 'origin' | 'target' | null

export const getWorkspaceComparisonFileRole = (
  moduleId: WorkspaceModuleId,
  fileName: string,
): WorkspaceComparisonFileRole => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const token = normalizeHeader(withoutExtension)

  const prefix = moduleId === 'clients'
    ? 'CLIENTE_'
    : moduleId === 'suppliers'
      ? 'FORNECEDOR_'
      : moduleId === 'sections'
        ? 'SECAO_'
        : moduleId === 'groups'
          ? 'GRUPO_'
          : moduleId === 'subgroups'
            ? 'SUBGRUPO_'
            : ''

  if (!prefix || !token.startsWith(prefix)) return null

  const suffix = token.slice(prefix.length)
  if (!suffix) return null

  if (suffix === 'INTERSOLID' || suffix === 'INTER_SOLID') return 'target'
  return 'origin'
}

export const WORKSPACE_PAIRED_MODULES: WorkspaceModuleId[] = [
  'clients',
  'suppliers',
  'sections',
  'groups',
  'subgroups',
]

const hasPairCoreStructure = (file: ImportedFile, moduleId: WorkspaceModuleId) => {
  switch (moduleId) {
    case 'clients':
      return hasExactHeader(file, ['COD_CLIENTE'])
        && hasExactHeader(file, ['DES_CLIENTE'])
    case 'suppliers':
      return hasExactHeader(file, ['COD_FORNECEDOR'])
        && hasExactHeader(file, ['DES_FORNECEDOR'])
    case 'sections':
      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['DES_SECAO'])
    case 'groups':
      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['COD_GRUPO'])
        && hasExactHeader(file, ['DES_GRUPO'])
    case 'subgroups':
      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['COD_GRUPO'])
        && hasExactHeader(file, ['COD_SUB_GRUPO'])
        && hasExactHeader(file, ['DES_SUB_GRUPO'])
    default:
      return false
  }
}

export type WorkspaceModulePairState = {
  moduleId: WorkspaceModuleId
  hasAnyFile: boolean
  originFiles: ImportedFile[]
  targetFiles: ImportedFile[]
  incompatibleFiles: ImportedFile[]
  originReady: boolean
  targetReady: boolean
  ready: boolean
}

export const getWorkspaceModulePairState = (
  files: ImportedFile[],
  moduleId: WorkspaceModuleId,
): WorkspaceModulePairState => {
  const scoped = files.filter(file => getExclusiveWorkspaceModuleFromFileName(file.name) === moduleId)
  const byPhysicalName = new Map<string, ImportedFile[]>()

  scoped.forEach(file => {
    const list = byPhysicalName.get(file.name) ?? []
    list.push(file)
    byPhysicalName.set(file.name, list)
  })

  const originFiles: ImportedFile[] = []
  const targetFiles: ImportedFile[] = []
  const incompatibleFiles: ImportedFile[] = []

  byPhysicalName.forEach(group => {
    const representative = group[0]
    const role = getWorkspaceComparisonFileRole(moduleId, representative.name)
    const compatibleSheets = group.filter(file => hasPairCoreStructure(file, moduleId))

    if (!role || compatibleSheets.length === 0) {
      incompatibleFiles.push(representative)
      return
    }

    if (role === 'origin') originFiles.push(...compatibleSheets)
    if (role === 'target') targetFiles.push(...compatibleSheets)
  })

  return {
    moduleId,
    hasAnyFile: scoped.length > 0,
    originFiles,
    targetFiles,
    incompatibleFiles,
    originReady: originFiles.length > 0,
    targetReady: targetFiles.length > 0,
    ready: originFiles.length > 0 && targetFiles.length > 0 && incompatibleFiles.length === 0,
  }
}

export const getWorkspacePairReadiness = (files: ImportedFile[]) => {
  const states = WORKSPACE_PAIRED_MODULES.map(moduleId =>
    getWorkspaceModulePairState(files, moduleId),
  )

  const byId = new Map(states.map(state => [state.moduleId, state]))
  const sectionReady = byId.get('sections')?.ready === true
  const groupReady = byId.get('groups')?.ready === true

  const relevant = states.filter(state => state.hasAnyFile)
  const blockers: string[] = []

  relevant.forEach(state => {
    const label = modules.find(module => module.id === state.moduleId)?.label ?? state.moduleId

    if (state.incompatibleFiles.length > 0) {
      blockers.push(
        label + ': existe arquivo com nome do módulo, mas os campos obrigatórios não correspondem ao padrão esperado.',
      )
      return
    }

    if (!state.originReady || !state.targetReady) {
      const missing = !state.originReady && !state.targetReady
        ? 'origem e destino'
        : !state.originReady
          ? 'origem'
          : 'destino'
      blockers.push(label + ': importe o arquivo de ' + missing + ' compatível para continuar.')
    }
  })

  if (byId.get('groups')?.hasAnyFile && !sectionReady) {
    blockers.push('Grupos: importe primeiro os dois arquivos compatíveis de Seções (origem e destino).')
  }

  if (byId.get('subgroups')?.hasAnyFile && (!sectionReady || !groupReady)) {
    blockers.push('Subgrupos: importe primeiro os pares completos de Seções e Grupos (origem e destino).')
  }

  return {
    states,
    blockers: [...new Set(blockers)],
    ready: relevant.length > 0 && blockers.length === 0,
  }
}

const fileNameSuggestsModule = (file: ImportedFile, module: WorkspaceModuleDefinition) => {
  const name = normalizeHeader(file.name + ' ' + (file.sheetName ?? ''))
  const tokens = [module.label, module.singular, ...module.signals]
    .map(normalizeHeader)
    .filter(token => token.length >= 5)
  return tokens.some(token => name.includes(token))
}

const moduleHasRequiredStructure = (file: ImportedFile, module: WorkspaceModuleDefinition) => {
  const productCode = hasAnyHeader(file, ['COD_PRODUTO', 'CODIGO_PRODUTO', 'COD_ITEM', 'ID_PRODUTO'])
  const moduleNameHint = fileNameSuggestsModule(file, module)

  switch (module.id) {
    case 'clients':
      return hasAnyHeader(file, ['COD_CLIENTE', 'CLIENTE_CODIGO', 'CODIGO_CLIENTE', 'DES_CLIENTE'])
        || moduleNameHint
    case 'suppliers':
      return hasAnyHeader(file, ['COD_FORNECEDOR', 'COD_FORNEC', 'COD_FORN', 'DES_FORNECEDOR', 'NOME_FORNECEDOR'])
        || moduleNameHint
    case 'carriers':
      return hasAnyHeader(file, ['COD_TRANSPORTADORA', 'COD_TRANSP', 'DES_TRANSPORTADORA', 'NOME_TRANSPORTADORA'])
        || moduleNameHint
    case 'sections': {
      const role = getWorkspaceComparisonFileRole('sections', file.name)
      if (!role) return false

      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['DES_SECAO'])
    }
    case 'groups': {
      const role = getWorkspaceComparisonFileRole('groups', file.name)
      if (!role) return false

      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['COD_GRUPO'])
        && hasExactHeader(file, ['DES_GRUPO'])
    }
    case 'subgroups': {
      const role = getWorkspaceComparisonFileRole('subgroups', file.name)
      if (!role) return false

      return hasExactHeader(file, ['COD_SECAO'])
        && hasExactHeader(file, ['COD_GRUPO'])
        && hasExactHeader(file, ['COD_SUB_GRUPO'])
        && hasExactHeader(file, ['DES_SUB_GRUPO'])
    }
    case 'products':
      return productCode || hasAnyHeader(file, ['DES_PRODUTO', 'DES_REDUZIDA', 'COD_BARRA_PRINCIPAL']) || moduleNameHint
    case 'productStore':
      return productCode && hasAnyHeader(file, ['COD_LOJA', 'CODIGO_LOJA', 'PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'])
    case 'barcodes':
      return productCode && hasAnyHeader(file, ['COD_BARRA', 'COD_BARRA_PRINCIPAL', 'CODIGO_BARRAS', 'EAN', 'GTIN'])
    case 'productSupplier':
      return productCode && hasAnyHeader(file, ['COD_FORNECEDOR', 'CODIGO_FORNECEDOR', 'REFERENCIA_FORNECEDOR'])
    case 'similarProducts':
      return productCode && hasAnyHeader(file, ['COD_PRODUTO_SIMILAR', 'COD_SIMILAR', 'PRODUTO_SIMILAR'])
    case 'ncm':
      return hasAnyHeader(file, ['NCM', 'COD_NCM'])
    case 'cest':
      return hasAnyHeader(file, ['CEST', 'COD_CEST'])
    case 'ibpt':
      return hasAnyHeader(file, ['IBPT', 'CHAVE_IBPT', 'ALIQUOTA_NACIONAL', 'ALIQ_NACIONAL'])
    case 'ibscbs':
      return hasAnyHeader(file, ['IBS', 'CBS', 'IBS_CBS', 'CST_IBS_CBS', 'ALIQUOTA_IBS', 'ALIQUOTA_CBS'])
    case 'taxBenefit':
      return hasAnyHeader(file, ['BENEFICIO_FISCAL', 'COD_BENEFICIO', 'CBENEF'])
    case 'recipes':
      return hasAnyHeader(file, ['RECEITA', 'FICHA_TECNICA', 'INGREDIENTE', 'COD_RECEITA'])
    case 'nutrition':
      return hasAnyHeader(file, ['NUTRICIONAL', 'VALOR_ENERGETICO', 'CALORIAS', 'PROTEINA', 'CARBOIDRATO'])
    default:
      return false
  }
}

const moduleScoreForFile = (file: ImportedFile, module: WorkspaceModuleDefinition) => {
  const exclusiveModule = getExclusiveWorkspaceModuleFromFileName(file.name)
  if (exclusiveModule && exclusiveModule !== module.id) {
    return {
      score: 0,
      matched: false,
      fieldHits: 0,
      signalHits: 0,
    }
  }

  const headers = file.headers
  const signalHits = module.signals.filter(signal =>
    headers.some(header => headerMatches(header, [signal])),
  ).length
  const fieldHits = module.fields.filter(item =>
    headers.some(header => headerMatches(header, item.aliases)),
  ).length
  const nameHit = fileNameSuggestsModule(file, module)
  const structuralMatch = moduleHasRequiredStructure(file, module)

  const score =
    signalHits * 30 +
    Math.min(45, fieldHits * 5) +
    (nameHit ? 18 : 0) +
    (structuralMatch ? 25 : 0)

  return {
    score,
    matched: structuralMatch && (fieldHits >= 1 || nameHit),
    fieldHits,
    signalHits,
  }
}

export const analyzeWorkspaceFiles = (files: ImportedFile[]): WorkspaceModuleMatch[] => {
  const detected = modules.map(module => {
    const matchedFiles = files.filter(file => moduleScoreForFile(file, module).matched)
    const matchedFields = module.fields.filter(item =>
      matchedFiles.some(file => file.headers.some(header => headerMatches(header, item.aliases))),
    )
    const headers = [...new Set(matchedFiles.flatMap(file =>
      file.headers.filter(header => matchedFields.some(item => headerMatches(header, item.aliases))),
    ))]
    const bestScore = Math.max(0, ...matchedFiles.map(file => moduleScoreForFile(file, module).score))

    return {
      module,
      fileIds: matchedFiles.map(file => file.id),
      fileNames: [...new Set(matchedFiles.map(file => file.name))],
      rowCount: matchedFiles.reduce((total, file) => total + file.rows.length, 0),
      matchedFields,
      headers,
      confidence: Math.min(99, bestScore),
    }
  }).filter(result => result.fileIds.length > 0)

  const hasSections = detected.some(result => result.module.id === 'sections')
  const hasGroups = detected.some(result => result.module.id === 'groups')

  return detected.filter(result => {
    if (result.module.id === 'groups') return hasSections
    if (result.module.id === 'subgroups') return hasSections && hasGroups
    return true
  })
}

export const getWorkspaceModule = (id: string) =>
  modules.find(module => module.id === id)

export const resolveModuleHeaders = (
  files: ImportedFile[],
  module: WorkspaceModuleDefinition,
) => {
  const matchedFiles = files.filter(file => moduleScoreForFile(file, module).matched)
  const resolvedFields = module.fields.map(item => {
    const header = matchedFiles
      .flatMap(file => file.headers)
      .find(candidate => headerMatches(candidate, item.aliases))
    return { ...item, header: header ?? '' }
  }).filter(item => item.header)

  return {
    files: matchedFiles,
    fields: resolvedFields,
    headers: [...new Set(resolvedFields.map(item => item.header))],
  }
}


const COMPARISON_META: Record<WorkspaceModuleId, {
  keyFieldIds: string[]
  nameFieldId: string
  duplicateFieldIds: string[]
  showDocumentValidity?: boolean
}> = {
  clients: { keyFieldIds: ['codigoInterno'], nameFieldId: 'nome', duplicateFieldIds: ['cpfCnpj', 'ie'], showDocumentValidity: true },
  suppliers: { keyFieldIds: ['codigoInterno'], nameFieldId: 'nome', duplicateFieldIds: ['cpfCnpj', 'ie'], showDocumentValidity: true },
  carriers: { keyFieldIds: ['codigoInterno'], nameFieldId: 'nome', duplicateFieldIds: ['cpfCnpj', 'ie'], showDocumentValidity: true },
  sections: { keyFieldIds: ['codigoSecao'], nameFieldId: 'descricaoSecao', duplicateFieldIds: ['codigoSecao'] },
  groups: { keyFieldIds: ['codigoSecao', 'codigoGrupo'], nameFieldId: 'descricaoGrupo', duplicateFieldIds: [] },
  subgroups: { keyFieldIds: ['codigoSecao', 'codigoGrupo', 'codigoSubgrupo'], nameFieldId: 'descricaoSubgrupo', duplicateFieldIds: [] },
  products: { keyFieldIds: ['codigoInterno'], nameFieldId: 'nome', duplicateFieldIds: ['codigoBarras'] },
  productStore: { keyFieldIds: ['codigoLoja', 'codigoProduto'], nameFieldId: 'codigoProduto', duplicateFieldIds: [] },
  barcodes: { keyFieldIds: ['codigoProduto', 'codigoBarras'], nameFieldId: 'codigoBarras', duplicateFieldIds: ['codigoBarras'] },
  productSupplier: { keyFieldIds: ['codigoProduto', 'codigoFornecedor'], nameFieldId: 'fornecedor', duplicateFieldIds: [] },
  similarProducts: { keyFieldIds: ['codigoProduto', 'codigoSimilar'], nameFieldId: 'descricaoSimilar', duplicateFieldIds: [] },
  ncm: { keyFieldIds: ['ncm'], nameFieldId: 'descricao', duplicateFieldIds: ['ncm'] },
  cest: { keyFieldIds: ['cest', 'ncm'], nameFieldId: 'descricao', duplicateFieldIds: ['cest'] },
  ibpt: { keyFieldIds: ['ncm'], nameFieldId: 'ncm', duplicateFieldIds: [] },
  ibscbs: { keyFieldIds: ['codigoProduto'], nameFieldId: 'codigoProduto', duplicateFieldIds: [] },
  taxBenefit: { keyFieldIds: ['codigo'], nameFieldId: 'descricao', duplicateFieldIds: ['codigo'] },
  recipes: { keyFieldIds: ['codigoReceita', 'codigoProduto'], nameFieldId: 'descricao', duplicateFieldIds: [] },
  nutrition: { keyFieldIds: ['codigoProduto'], nameFieldId: 'codigoProduto', duplicateFieldIds: [] },
}

const inferFieldKind = (id: string): FieldDefinition['kind'] => {
  const token = id.toLocaleLowerCase('pt-BR')
  if (id === 'cpfCnpj') return 'document'
  if (id === 'ie') return 'ie'
  if (token.includes('telefone') || token.includes('celular') || token.includes('fax')) return 'phone'
  if (token === 'uf') return 'state'
  if (token.includes('data')) return 'date'
  if (
    token.includes('preco') ||
    token.includes('custo') ||
    token.includes('margem') ||
    token.includes('aliq') ||
    token === 'ibs' ||
    token === 'cbs'
  ) return 'money'
  if (
    token.includes('ativo') ||
    token.includes('inativo') ||
    token.includes('principal') ||
    token.includes('envia') ||
    token.includes('bebida') ||
    token.includes('fora') ||
    token.includes('vasilhame')
  ) return 'boolean'
  if (
    token.includes('codigo') ||
    token === 'ncm' ||
    token === 'cest' ||
    token === 'ex' ||
    token === 'plu' ||
    token === 'chave'
  ) return 'code'
  return 'text'
}

const moduleFieldGroup = (module: WorkspaceModuleDefinition) => {
  if (module.group === 'partners') return 'Cadastro'
  if (module.group === 'structure') return 'Estrutura'
  if (module.group === 'products') return 'Produto'
  return 'Fiscal e Conteúdo'
}

const baseProfileForModule = (moduleId: WorkspaceModuleId) => {
  if (moduleId === 'clients') return clientProfile
  if (moduleId === 'suppliers') return supplierProfile
  if (moduleId === 'sections') return sectionProfile
  if (moduleId === 'groups') return groupProfile
  if (moduleId === 'subgroups') return subgroupProfile
  if (moduleId === 'products') return productProfile
  return undefined
}

export const getWorkspaceEntityProfile = (moduleId: WorkspaceModuleId): EntityProfile => {
  const module = modules.find(item => item.id === moduleId)
  if (!module) return clientProfile

  const meta = COMPARISON_META[moduleId]
  const base = baseProfileForModule(moduleId)
  const baseFields = new Map(base?.fields.map(item => [item.id, item]) ?? [])

  const fields: FieldDefinition[] = module.fields.map(item => {
    const existing = baseFields.get(item.id)
    return {
      ...(existing ?? {
        id: item.id,
        label: item.label,
        group: moduleFieldGroup(module),
        kind: inferFieldKind(item.id),
        aliases: item.aliases,
      }),
      aliases: [...new Set([item.label, ...item.aliases, ...(existing?.aliases ?? [])])],
      requiredForMatch: meta.keyFieldIds.includes(item.id),
    }
  })

  return {
    id: 'workspace:' + module.id,
    label: module.label,
    description: module.description,
    aliases: [module.label, module.singular, ...module.signals],
    fields,
    statusAliases: base?.statusAliases ?? ['INATIVO', 'FLG_INATIVO', 'ATIVO', 'FLG_ATIVO', 'STATUS', 'SITUACAO'],
    nameFieldId: meta.nameFieldId,
    recordLabel: module.singular,
    showDocumentValidity: meta.showDocumentValidity ?? false,
    duplicateFieldIds: meta.duplicateFieldIds,
    ambiguousBareTokens: base?.ambiguousBareTokens ?? [],
  }
}

export const WORKSPACE_ENTITY_PROFILES: EntityProfile[] =
  modules.map(module => getWorkspaceEntityProfile(module.id))
