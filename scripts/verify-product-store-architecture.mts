import assert from 'node:assert/strict'
import {
  PRODUCT_STORE_ARCHITECTURE,
  WORKSPACE_GROUPS,
  WORKSPACE_MODULES,
} from '../src/config/workspaceModules'

const productGroup = WORKSPACE_GROUPS.find(group => group.id === 'products')
assert.ok(productGroup, 'Grupo de produtos não encontrado')
assert.equal(productGroup.label, 'Produto por Loja')
assert.deepEqual(
  productGroup.modules,
  ['productStore', 'products', 'barcodes', 'similarProducts', 'productSupplier'],
)

assert.equal(PRODUCT_STORE_ARCHITECTURE.primaryModule, 'productStore')
assert.equal(PRODUCT_STORE_ARCHITECTURE.baseModule, 'products')
assert.deepEqual(
  [...PRODUCT_STORE_ARCHITECTURE.relationshipModules],
  ['barcodes', 'similarProducts', 'productSupplier'],
)

const productStore = WORKSPACE_MODULES.find(module => module.id === 'productStore')
const baseProduct = WORKSPACE_MODULES.find(module => module.id === 'products')

assert.equal(productStore?.label, 'Produto por Loja')
assert.equal(baseProduct?.label, 'Cadastro Base do Produto')

console.log('Product Store architecture verification: OK')
