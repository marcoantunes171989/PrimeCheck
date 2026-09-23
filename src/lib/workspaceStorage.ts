import type { FieldMapping, ImportedFile } from '../types'

const DB_NAME = 'primecheck-local'
const DB_VERSION = 1
const STORE_NAME = 'workspace'
const IMPORTED_FILES_KEY = 'imported-files-v1'
const WORKSPACE_SESSION_KEY = 'workspace-session-v1'

export interface WorkspaceSessionState {
  activeModule: string
  visitedModuleIds: string[]
  selections: Record<string, {
    originName: string
    targetName: string
  }>
  mappings: Record<string, FieldMapping[]>
}

const emptySession = (): WorkspaceSessionState => ({
  activeModule: 'importacao',
  visitedModuleIds: [],
  selections: {},
  mappings: {},
})

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

const hasLocalStorage = () =>
  typeof window !== 'undefined' && 'localStorage' in window

export const loadWorkspaceSession = (): WorkspaceSessionState => {
  if (!hasLocalStorage()) return emptySession()

  try {
    const raw = window.localStorage.getItem(WORKSPACE_SESSION_KEY)
    if (!raw) return emptySession()

    const parsed = JSON.parse(raw) as Partial<WorkspaceSessionState>
    return {
      activeModule: typeof parsed.activeModule === 'string' ? parsed.activeModule : 'importacao',
      visitedModuleIds: Array.isArray(parsed.visitedModuleIds)
        ? parsed.visitedModuleIds.filter((value): value is string => typeof value === 'string')
        : [],
      selections: parsed.selections && typeof parsed.selections === 'object'
        ? parsed.selections as WorkspaceSessionState['selections']
        : {},
      mappings: parsed.mappings && typeof parsed.mappings === 'object'
        ? parsed.mappings as WorkspaceSessionState['mappings']
        : {},
    }
  } catch {
    return emptySession()
  }
}

const saveWorkspaceSession = (session: WorkspaceSessionState) => {
  if (!hasLocalStorage()) return
  window.localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(session))
}

const updateWorkspaceSession = (
  update: (current: WorkspaceSessionState) => WorkspaceSessionState,
) => {
  saveWorkspaceSession(update(loadWorkspaceSession()))
}

export const saveWorkspaceNavigation = (
  activeModule: string,
  visitedModuleIds: string[],
) => {
  updateWorkspaceSession(current => ({
    ...current,
    activeModule,
    visitedModuleIds: [...new Set(visitedModuleIds)],
  }))
}

export const loadWorkspaceComparisonSelection = (moduleId: string) =>
  loadWorkspaceSession().selections[moduleId]

export const saveWorkspaceComparisonSelection = (
  moduleId: string,
  originName: string,
  targetName: string,
) => {
  updateWorkspaceSession(current => ({
    ...current,
    selections: {
      ...current.selections,
      [moduleId]: { originName, targetName },
    },
  }))
}

const mappingKey = (moduleId: string, originName: string, targetName: string) =>
  [moduleId, originName, targetName].map(value => encodeURIComponent(value)).join('|')

export const loadWorkspaceMapping = (
  moduleId: string,
  originName: string,
  targetName: string,
): FieldMapping[] => {
  if (!originName || !targetName) return []
  const stored = loadWorkspaceSession().mappings[mappingKey(moduleId, originName, targetName)]
  return Array.isArray(stored) ? stored : []
}

export const saveWorkspaceMapping = (
  moduleId: string,
  originName: string,
  targetName: string,
  mapping: FieldMapping[],
) => {
  if (!originName || !targetName) return

  updateWorkspaceSession(current => ({
    ...current,
    mappings: {
      ...current.mappings,
      [mappingKey(moduleId, originName, targetName)]: mapping,
    },
  }))
}

export const clearWorkspaceSession = () => {
  if (!hasLocalStorage()) return
  window.localStorage.removeItem(WORKSPACE_SESSION_KEY)
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
