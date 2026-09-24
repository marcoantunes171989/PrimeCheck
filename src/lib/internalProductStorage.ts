import { initializeWorkspaceScope, openPrimeCheckDb } from './workspaceStorage'

export interface InternalProductRow {
  id: string
  code: string
  description: string
  sourceSheet?: string
}

export interface InternalProductSnapshot {
  fileName: string
  size: number
  extension: string
  importedAt: string
  codeHeaders: string[]
  descriptionHeaders: string[]
  rows: InternalProductRow[]
}

const STORE_NAME = 'workspace'
const LEGACY_INTERNAL_PRODUCTS_KEY = 'internal-product-list-v1'
const INTERNAL_PRODUCTS_KEY_PREFIX = 'internal-product-list-v2'

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openPrimeCheckDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
      const request = action(store)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento local.'))
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação local.'))
    })
  } finally {
    db.close()
  }
}

const resolveInternalProductsKey = async () => {
  const scope = await initializeWorkspaceScope()
  return scope ? `${INTERNAL_PRODUCTS_KEY_PREFIX}:${scope}` : ''
}

const isValidSnapshot = (value: InternalProductSnapshot | undefined | null): value is InternalProductSnapshot =>
  Boolean(value?.rows && Array.isArray(value.rows))

const migrateLegacySnapshot = async (scopedKey: string) => {
  const current = await withStore<InternalProductSnapshot | undefined>(
    'readonly',
    store => store.get(scopedKey),
  )
  if (isValidSnapshot(current)) return current

  const legacy = await withStore<InternalProductSnapshot | undefined>(
    'readonly',
    store => store.get(LEGACY_INTERNAL_PRODUCTS_KEY),
  )
  if (!isValidSnapshot(legacy)) return null

  await withStore<IDBValidKey>(
    'readwrite',
    store => store.put(legacy, scopedKey),
  )
  await withStore<undefined>(
    'readwrite',
    store => store.delete(LEGACY_INTERNAL_PRODUCTS_KEY),
  )
  return legacy
}

export const loadInternalProductList = async (): Promise<InternalProductSnapshot | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null

  const scopedKey = await resolveInternalProductsKey()
  if (!scopedKey) {
    throw new Error('Não foi possível identificar o IP atual para restaurar a lista de produtos.')
  }

  const migrated = await migrateLegacySnapshot(scopedKey)
  if (migrated) return migrated

  const stored = await withStore<InternalProductSnapshot | undefined>(
    'readonly',
    store => store.get(scopedKey),
  )
  return isValidSnapshot(stored) ? stored : null
}

export const saveInternalProductList = async (snapshot: InternalProductSnapshot): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return

  const scopedKey = await resolveInternalProductsKey()
  if (!scopedKey) {
    throw new Error('Não foi possível identificar o IP atual para salvar a lista de produtos.')
  }

  await withStore<IDBValidKey>(
    'readwrite',
    store => store.put(snapshot, scopedKey),
  )
}

export const clearInternalProductList = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return

  const scopedKey = await resolveInternalProductsKey()
  if (!scopedKey) return

  await withStore<undefined>(
    'readwrite',
    store => store.delete(scopedKey),
  )
}
