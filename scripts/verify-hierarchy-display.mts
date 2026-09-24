import assert from 'node:assert/strict'
import {
  buildHierarchyVisual,
  hierarchySearchValue,
  isGroupHierarchyProfile,
  isSubgroupHierarchyProfile,
} from '../src/lib/hierarchyDisplay'

const subgroupClient = {
  key: '1 / 5 / 1',
  name: 'PEIXE CONGELADO',
  fields: [
    { fieldId: 'codigoSecao', originValue: '001', targetValue: '1' },
    { fieldId: 'codigoGrupo', originValue: '005', targetValue: '5' },
  ],
  originRow: {
    COD_SECAO: '001',
    COD_GRUPO: '005',
    COD_SUB_GRUPO: '001',
    DES_SUB_GRUPO: 'PEIXE CONGELADO',
  },
  targetRow: {
    COD_SECAO: '1',
    DES_SECAO: 'PESCADOS',
    COD_GRUPO: '5',
    DES_GRUPO: 'PEIXE',
    COD_SUB_GRUPO: '1',
    DES_SUB_GRUPO: 'PEIXE CONGELADO',
  },
}

const groupClient = {
  key: '1 / 5',
  name: 'PEIXE',
  fields: [
    { fieldId: 'codigoSecao', originValue: '001', targetValue: '1' },
    { fieldId: 'codigoGrupo', originValue: '005', targetValue: '5' },
  ],
  originRow: {
    COD_SECAO: '001',
    COD_GRUPO: '005',
    DES_GRUPO: 'PEIXE',
  },
  targetRow: {
    COD_SECAO: '1',
    DES_SECAO: 'PESCADOS',
    COD_GRUPO: '5',
    DES_GRUPO: 'PEIXE',
  },
}

assert.equal(isGroupHierarchyProfile('workspace:groups'), true)
assert.equal(isSubgroupHierarchyProfile('workspace:subgroups'), true)

assert.equal(
  buildHierarchyVisual(groupClient as any, 'workspace:groups').displayLabel,
  'PESCADOS | PEIXE',
)

assert.equal(
  buildHierarchyVisual(subgroupClient as any, 'workspace:subgroups').displayLabel,
  'PESCADOS | PEIXE | PEIXE CONGELADO',
)

assert.equal(
  hierarchySearchValue(groupClient as any, 'workspace:groups', 'SECTION'),
  'PESCADOS',
)
assert.equal(
  hierarchySearchValue(groupClient as any, 'workspace:groups', 'GROUP'),
  'PEIXE',
)
assert.equal(
  hierarchySearchValue(subgroupClient as any, 'workspace:subgroups', 'SECTION'),
  'PESCADOS',
)
assert.equal(
  hierarchySearchValue(subgroupClient as any, 'workspace:subgroups', 'GROUP'),
  'PEIXE',
)
assert.equal(
  hierarchySearchValue(subgroupClient as any, 'workspace:subgroups', 'SUBGROUP'),
  'PEIXE CONGELADO',
)
assert.equal(
  hierarchySearchValue(subgroupClient as any, 'workspace:subgroups', 'ALL'),
  'PESCADOS | PEIXE | PEIXE CONGELADO',
)

const fallbackClient = {
  ...subgroupClient,
  targetRow: {
    COD_SECAO: '1',
    COD_GRUPO: '5',
    COD_SUB_GRUPO: '1',
    DES_SUB_GRUPO: 'PEIXE CONGELADO',
  },
}

assert.equal(
  buildHierarchyVisual(
    fallbackClient as any,
    'workspace:subgroups',
    {
      sectionNames: { '1': 'PESCADOS' },
      groupNames: { '1|5': 'PEIXE' },
    },
  ).displayLabel,
  'PESCADOS | PEIXE | PEIXE CONGELADO',
)

console.log('Hierarchy display and level search verification: OK')
