import type { ImportedFile } from '../types'

const DB_NAME = 'primecheck-local'
const DB_VERSION = 1
const STORE_NAME = 'workspace'
const IMPORTED_FILES_KEY = 'imported-files-v1'

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

export const loadWorkspaceFiles = async (): Promise<ImportedFile[]> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return []
  try {
    const stored = await withStore<ImportedFile[] | undefined>(
      'readonly',
      store => store.get(IMPORTED_FILES_KEY),
    )
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export const saveWorkspaceFiles = async (files: ImportedFile[]): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<IDBValidKey>(
    'readwrite',
    store => store.put(files, IMPORTED_FILES_KEY),
  )
}

export const clearWorkspaceFiles = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<undefined>(
    'readwrite',
    store => store.delete(IMPORTED_FILES_KEY),
  )
}
