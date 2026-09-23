export type CellValue = string | number | boolean | Date | null | undefined
export type DataRow = Record<string, CellValue>

export type Severity = 'CONFORME' | 'ATENÇÃO' | 'DIVERGENTE' | 'NÃO VALIDÁVEL' | 'NÃO IMPORTADO'

export interface ImportedFile {
  id: string
  name: string
  size: number
  extension: string
  sheetName?: string
  rows: DataRow[]
  headers: string[]
}

export interface Dataset {
  files: ImportedFile[]
  rows: DataRow[]
  headers: string[]
}

export interface FieldDefinition {
  id: string
  label: string
  group: string
  checklistLabel?: string
  databaseField?: string
  originExactAliases?: string[]
  aliases: string[]
  kind: 'text' | 'code' | 'document' | 'ie' | 'phone' | 'date' | 'money' | 'personType' | 'boolean' | 'sex' | 'state'
  requiredForMatch?: boolean
  required?: boolean
  priority?: number
  validation?: string
  normalizer?: string
}

export interface EntityAmbiguityGuard {
  token: string
  fieldIds: string[]
}

export interface EntityProfile {
  id: string
  label: string
  description: string
  aliases: string[]
  fields: FieldDefinition[]
  statusAliases: string[]
  nameFieldId: string
  recordLabel: string
  showDocumentValidity?: boolean
  duplicateFieldIds: string[]
  ambiguousBareTokens: EntityAmbiguityGuard[]
}

export interface EntityDetection {
  profileId: string
  confidence: number
  scores: Array<{ profileId: string; label: string; confidence: number }>
  lowConfidence: boolean
  reason: string
}

export interface FieldMapping {
  fieldId: string
  originHeader: string
  targetHeader: string
  originManual?: boolean
  targetManual?: boolean
}

export interface ManualFieldAdjustment {
  originalTargetValue: string
  adjustedValue: string
  status: Exclude<Severity, 'NÃO IMPORTADO'>
  note: string
  adjustedAt: string
}

export interface ComparisonFieldResult {
  fieldId: string
  fieldLabel: string
  group: string
  originValue: string
  targetValue: string
  status: Severity
  reason: string
  manualAdjustment?: ManualFieldAdjustment
}

export interface ClientComparison {
  key: string
  name: string
  originRow: DataRow
  targetRow?: DataRow
  found: boolean
  originInactive: boolean
  status: Severity
  divergentCount: number
  attentionCount: number
  fields: ComparisonFieldResult[]
}

export interface DuplicateRecordExtra {
  id: string
  label: string
  value: string
}

export interface DuplicateRecord {
  key: string
  name: string
  rawValue: string
  extras: DuplicateRecordExtra[]
}

export interface DuplicateItem {
  side: 'ORIGEM' | 'DESTINO'
  fieldId: string
  fieldLabel: string
  fieldGroup: string
  category: string
  normalizedValue: string
  count: number
  records: DuplicateRecord[]
}

export interface FieldSummary {
  fieldId: string
  fieldLabel: string
  group: string
  conform: number
  divergent: number
  attention: number
  notValidatable: number
  conformityPercent: number | null
}

export interface ComparisonSummary {
  originTotal: number
  targetTotal: number
  foundTotal: number
  conformClients: number
  divergentClients: number
  attentionClients: number
  notImportedClients: number
  targetOnlyClients: number
  validTests: number
  conformTests: number
}

export interface ComparisonReport {
  generatedAt: string
  profileId: string
  mapping: FieldMapping[]
  clients: ClientComparison[]
  duplicates: DuplicateItem[]
  fieldSummary: FieldSummary[]
  summary: ComparisonSummary
  targetOnly: Array<{ key: string; name: string; row: DataRow }>
}
