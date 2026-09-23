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

const DB_NAME = 'primecheck-local'
const DB_VERSION = 1
const STORE_NAME = 'workspace'
const INTERNAL_PRODUCTS_KEY = 'internal-product-list-v1'

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = window.indexedDB.open(DB_NAME, DB_VERSION)

  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME)
    }
  }

  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Falha ao abrir armazenamento local.'))
})

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
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

export const loadInternalProductList = async (): Promise<InternalProductSnapshot | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null
  try {
    const stored = await withStore<InternalProductSnapshot | undefined>(
      'readonly',
      store => store.get(INTERNAL_PRODUCTS_KEY),
    )
    return stored?.rows && Array.isArray(stored.rows) ? stored : null
  } catch {
    return null
  }
}

export const saveInternalProductList = async (snapshot: InternalProductSnapshot): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<IDBValidKey>(
    'readwrite',
    store => store.put(snapshot, INTERNAL_PRODUCTS_KEY),
  )
}

export const clearInternalProductList = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<undefined>(
    'readwrite',
    store => store.delete(INTERNAL_PRODUCTS_KEY),
  )
}
