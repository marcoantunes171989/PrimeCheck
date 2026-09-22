import { detectEntityProfile, getEntityProfile } from '../src/config/entities/index.ts'
import { autoMap } from '../src/lib/mapping.ts'
import { compareDatasets } from '../src/lib/compare.ts'
import { repairEncoding } from '../src/lib/normalizers.ts'
import type { Dataset, FieldMapping } from '../src/types/index.ts'

const dataset = (headers: string[], rows: Array<Record<string, string>> = [{}]): Dataset => ({
  files: [],
  headers,
  rows,
})

const mapped = (mapping: FieldMapping[], fieldId: string) =>
  mapping.find(item => item.fieldId === fieldId)

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const clientOrigin = ['COD_CLIENTE', 'DES_CLIENTE', 'NUM_CGC', 'NUM_INSC_EST']
const clientTarget = ['Cod. Cliente', 'Descrição do Cliente', 'CPF/CNPJ', 'I.E']
const supplierHeaders = ['COD_FORNECEDOR', 'RAZAO_SOCIAL', 'CNPJ', 'IE']
const productHeaders = ['COD_PRODUTO', 'DES_PRODUTO', 'COD_BARRA_PRINCIPAL', 'NCM']
const ambiguousHeaders = ['CODIGO', 'DESCRICAO', 'STATUS']

const clientDetection = detectEntityProfile(clientOrigin, ['EXPORTACAO_22092026.xlsx'])
assert(clientDetection.profileId === 'client', `Cliente detectado como ${clientDetection.profileId}`)
assert(!clientDetection.lowConfidence, `Cliente deveria ter confiança alta, veio ${clientDetection.confidence}`)

const supplierDetection = detectEntityProfile(supplierHeaders)
assert(supplierDetection.profileId === 'supplier', `Fornecedor detectado como ${supplierDetection.profileId}`)
assert(!supplierDetection.lowConfidence, `Fornecedor deveria ter confiança alta, veio ${supplierDetection.confidence}`)

const productDetection = detectEntityProfile(productHeaders)
assert(productDetection.profileId === 'product', `Produto detectado como ${productDetection.profileId}`)
assert(!productDetection.lowConfidence, `Produto deveria ter confiança alta, veio ${productDetection.confidence}`)

const ambiguousDetection = detectEntityProfile(ambiguousHeaders, ['EXPORTACAO_22092026.xlsx'])
assert(ambiguousDetection.lowConfidence, 'Colunas genéricas não deveriam forçar um perfil')

assert(repairEncoding('DescriÃ§Ã£o do Cliente') === 'Descrição do Cliente', 'Mojibake de descrição')
assert(repairEncoding('EndereÃ§o') === 'Endereço', 'Mojibake de endereço')
assert(repairEncoding('AgÃªncia') === 'Agência', 'Mojibake de agência')
assert(repairEncoding('AutomÃ³vel') === 'Automóvel', 'Mojibake de automóvel')
assert(repairEncoding('CartÃ£o') === 'Cartão', 'Mojibake de cartão')

const clientProfile = getEntityProfile('client')
const clientMap = autoMap(dataset(clientOrigin), dataset(clientTarget), clientProfile)
assert(mapped(clientMap, 'codigoInterno')?.originHeader === 'COD_CLIENTE', 'Código origem cliente')
assert(mapped(clientMap, 'codigoInterno')?.targetHeader === 'Cod. Cliente', 'Código destino cliente')
assert(mapped(clientMap, 'nome')?.originHeader === 'DES_CLIENTE', 'Nome origem cliente')
assert(mapped(clientMap, 'nome')?.targetHeader === 'Descrição do Cliente', 'Nome destino cliente')
assert(mapped(clientMap, 'cpfCnpj')?.originHeader === 'NUM_CGC', 'Documento origem cliente')
assert(mapped(clientMap, 'cpfCnpj')?.targetHeader === 'CPF/CNPJ', 'Documento destino cliente')
assert(mapped(clientMap, 'ie')?.originHeader === 'NUM_INSC_EST', 'IE origem cliente')
assert(mapped(clientMap, 'ie')?.targetHeader === 'I.E', 'IE destino cliente')

const mojibakeMap = autoMap(
  dataset(['COD_CLIENTE', 'DescriÃ§Ã£o do Cliente', 'EndereÃ§o']),
  dataset(['Cod. Cliente', 'Descrição do Cliente', 'Endereço']),
  clientProfile,
)
assert(mapped(mojibakeMap, 'nome')?.originHeader === 'DescriÃ§Ã£o do Cliente', 'Alias com mojibake deve mapear para Nome')
assert(mapped(mojibakeMap, 'endereco')?.originHeader === 'EndereÃ§o', 'Endereço com mojibake deve mapear')

const supplierProfile = getEntityProfile('supplier')
const supplierMap = autoMap(dataset(supplierHeaders), dataset(supplierHeaders), supplierProfile)
assert(mapped(supplierMap, 'codigoInterno')?.originHeader === 'COD_FORNECEDOR', 'Código fornecedor')
assert(mapped(supplierMap, 'nome')?.originHeader === 'RAZAO_SOCIAL', 'Razão social fornecedor')
assert(mapped(supplierMap, 'cpfCnpj')?.originHeader === 'CNPJ', 'CNPJ fornecedor')
assert(mapped(supplierMap, 'ie')?.originHeader === 'IE', 'IE fornecedor')

const productProfile = getEntityProfile('product')
const productMap = autoMap(dataset(productHeaders), dataset(productHeaders), productProfile)
assert(mapped(productMap, 'codigoInterno')?.originHeader === 'COD_PRODUTO', 'Código produto')
assert(mapped(productMap, 'nome')?.originHeader === 'DES_PRODUTO', 'Descrição produto')
assert(mapped(productMap, 'codigoBarras')?.originHeader === 'COD_BARRA_PRINCIPAL', 'Código de barras')
assert(mapped(productMap, 'ncm')?.originHeader === 'NCM', 'NCM')

const conservativeMap = autoMap(
  dataset(ambiguousHeaders),
  dataset(ambiguousHeaders),
  clientProfile,
  { allowGenericHeaders: false },
)
assert(!mapped(conservativeMap, 'codigoInterno')?.originHeader, 'CODIGO genérico não deve auto-vincular')
assert(!mapped(conservativeMap, 'nome')?.originHeader, 'DESCRICAO genérica não deve auto-vincular no perfil Cliente')

const originRows = [{
  COD_CLIENTE: '100',
  DES_CLIENTE: 'ACME LTDA',
  NUM_CGC: '04.252.011/0001-10',
  NUM_INSC_EST: 'ISENTO',
}]
const targetRows = [{
  'Cod. Cliente': '100',
  'Descrição do Cliente': 'ACME LTDA',
  'CPF/CNPJ': '04.252.011/0001-10',
  'I.E': 'ISENTO',
}]
const report = compareDatasets(
  dataset(clientOrigin, originRows),
  dataset(clientTarget, targetRows),
  clientMap,
  clientProfile,
)
assert(report.profileId === 'client', 'Relatório precisa gravar o perfil')
assert(report.summary.foundTotal === 1, 'Registro cliente precisa ser encontrado')
assert(report.clients[0].status === 'CONFORME', `Regressão cliente deveria ser CONFORME, veio ${report.clients[0].status}`)

console.log('PrimeCheck entity verification OK')
console.log(JSON.stringify({
  client: clientDetection,
  supplier: supplierDetection,
  product: productDetection,
  ambiguous: ambiguousDetection,
}, null, 2))
