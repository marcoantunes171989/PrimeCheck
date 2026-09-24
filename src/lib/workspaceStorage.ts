import type { FieldMapping, ImportedFile } from '../types'
import type { NfceSummary } from './nfce'

const DB_NAME = 'primecheck-local'
const STORE_NAME = 'workspace'
const NFCE_STORE_NAME = 'nfce-xml'

const LEGACY_IMPORTED_FILES_KEY = 'imported-files-v1'
const LEGACY_WORKSPACE_SESSION_KEY = 'workspace-session-v1'
const IMPORTED_FILES_KEY_PREFIX = 'imported-files-v2'
const WORKSPACE_SESSION_KEY_PREFIX = 'workspace-session-v2'

let activeWorkspaceScope = ''

export interface WorkspaceExecutionState {
  mappingSignature: string
  dataSignature: string
}

export interface WorkspaceSessionState {
  activeModule: string
  visitedModuleIds: string[]
  selections: Record<string, {
    originName: string
    targetName: string
  }>
  mappings: Record<string, FieldMapping[]>
  executions: Record<string, WorkspaceExecutionState>
}

const emptySession = (): WorkspaceSessionState => ({
  activeModule: 'importacao',
  visitedModuleIds: [],
  selections: {},
  mappings: {},
  executions: {},
})

const createMissingStores = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME)
  }
  if (!db.objectStoreNames.contains(NFCE_STORE_NAME)) {
    db.createObjectStore(NFCE_STORE_NAME)
  }
}

const upgradeMissingStores = (currentVersion: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, currentVersion + 1)

    request.onupgradeneeded = () => createMissingStores(request.result)
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('Falha ao atualizar armazenamento local.'))
    request.onblocked = () => reject(new Error(
      'O armazenamento local está aberto em outra aba. Feche as outras abas do PrimeCheck e tente novamente.',
    ))
  })

export const openPrimeCheckDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    // Não fixa uma versão numérica: abre sempre a versão já existente no navegador.
    // Isso evita VersionError quando uma versão anterior do PrimeCheck tenta abrir
    // um IndexedDB que já foi atualizado por uma versão mais nova.
    const request = window.indexedDB.open(DB_NAME)

    request.onupgradeneeded = () => createMissingStores(request.result)
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()

      const hasWorkspace = db.objectStoreNames.contains(STORE_NAME)
      const hasNfce = db.objectStoreNames.contains(NFCE_STORE_NAME)

      if (hasWorkspace && hasNfce) {
        resolve(db)
        return
      }

      const currentVersion = db.version
      db.close()
      void upgradeMissingStores(currentVersion).then(resolve, reject)
    }
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir armazenamento local.'))
  })

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = STORE_NAME,
) => {
  const db = await openPrimeCheckDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
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

const importedFilesKey = () =>
  activeWorkspaceScope ? `${IMPORTED_FILES_KEY_PREFIX}:${activeWorkspaceScope}` : ''

const workspaceSessionKey = () =>
  activeWorkspaceScope ? `${WORKSPACE_SESSION_KEY_PREFIX}:${activeWorkspaceScope}` : ''

const hashScope = async (value: string) => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const input = new TextEncoder().encode(`primecheck:${value}`)
    const digest = await window.crypto.subtle.digest('SHA-256', input)
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24)
  }

  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fallback-${(hash >>> 0).toString(16)}`
}

const migrateLegacyWorkspace = async () => {
  const sessionKey = workspaceSessionKey()
  const filesKey = importedFilesKey()
  if (!sessionKey || !filesKey) return

  if (hasLocalStorage()) {
    const scopedSession = window.localStorage.getItem(sessionKey)
    const legacySession = window.localStorage.getItem(LEGACY_WORKSPACE_SESSION_KEY)
    if (!scopedSession && legacySession) {
      window.localStorage.setItem(sessionKey, legacySession)
    }
    if (legacySession) {
      window.localStorage.removeItem(LEGACY_WORKSPACE_SESSION_KEY)
    }
  }

  if (typeof window === 'undefined' || !('indexedDB' in window)) return

  try {
    const scopedFiles = await withStore<ImportedFile[] | undefined>(
      'readonly',
      store => store.get(filesKey),
    )
    const legacyFiles = await withStore<ImportedFile[] | undefined>(
      'readonly',
      store => store.get(LEGACY_IMPORTED_FILES_KEY),
    )

    if ((!Array.isArray(scopedFiles) || scopedFiles.length === 0) && Array.isArray(legacyFiles) && legacyFiles.length > 0) {
      await withStore<IDBValidKey>('readwrite', store => store.put(legacyFiles, filesKey))
    }

    if (Array.isArray(legacyFiles)) {
      await withStore<undefined>('readwrite', store => store.delete(LEGACY_IMPORTED_FILES_KEY))
    }
  } catch {
    // Migração é oportunista; a restauração normal continua usando o escopo atual.
  }
}

export const initializeWorkspaceScope = async (): Promise<string> => {
  if (activeWorkspaceScope) return activeWorkspaceScope
  if (typeof window === 'undefined') return ''

  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

  try {
    if (localHost) {
      activeWorkspaceScope = 'local-development'
    } else {
      const response = await window.fetch('/api/client-ip', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error('IP indisponível.')

      const payload = await response.json() as { ip?: unknown }
      const ip = typeof payload.ip === 'string' ? payload.ip.trim() : ''
      if (!ip) throw new Error('IP indisponível.')

      activeWorkspaceScope = await hashScope(ip)
    }

    await migrateLegacyWorkspace()
    return activeWorkspaceScope
  } catch {
    activeWorkspaceScope = ''
    return ''
  }
}

export const loadWorkspaceSession = (): WorkspaceSessionState => {
  const key = workspaceSessionKey()
  if (!hasLocalStorage() || !key) return emptySession()

  try {
    const raw = window.localStorage.getItem(key)
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
      executions: parsed.executions && typeof parsed.executions === 'object'
        ? parsed.executions as WorkspaceSessionState['executions']
        : {},
    }
  } catch {
    return emptySession()
  }
}

const saveWorkspaceSession = (session: WorkspaceSessionState) => {
  const key = workspaceSessionKey()
  if (!hasLocalStorage() || !key) return
  window.localStorage.setItem(key, JSON.stringify(session))
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

const mappingSignature = (mapping: FieldMapping[]) =>
  JSON.stringify(mapping.map(item => ({
    fieldId: item.fieldId,
    originHeader: item.originHeader,
    targetHeader: item.targetHeader,
    originManual: item.originManual === true,
    targetManual: item.targetManual === true,
  })))

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

export const hasWorkspaceExecution = (
  moduleId: string,
  originName: string,
  targetName: string,
  mapping: FieldMapping[],
  dataSignature: string,
) => {
  if (!originName || !targetName || !mapping.length || !dataSignature) return false
  const stored = loadWorkspaceSession().executions[mappingKey(moduleId, originName, targetName)]
  return Boolean(
    stored
    && stored.mappingSignature === mappingSignature(mapping)
    && stored.dataSignature === dataSignature,
  )
}

export const saveWorkspaceExecution = (
  moduleId: string,
  originName: string,
  targetName: string,
  mapping: FieldMapping[],
  dataSignature: string,
) => {
  if (!originName || !targetName || !mapping.length || !dataSignature) return

  updateWorkspaceSession(current => ({
    ...current,
    executions: {
      ...current.executions,
      [mappingKey(moduleId, originName, targetName)]: {
        mappingSignature: mappingSignature(mapping),
        dataSignature,
      },
    },
  }))
}

export const clearWorkspaceSession = () => {
  if (!hasLocalStorage()) return

  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && (key === LEGACY_WORKSPACE_SESSION_KEY || key.startsWith(`${WORKSPACE_SESSION_KEY_PREFIX}:`))) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => window.localStorage.removeItem(key))
}

export const loadWorkspaceFiles = async (): Promise<ImportedFile[]> => {
  const key = importedFilesKey()
  if (!key || typeof window === 'undefined' || !('indexedDB' in window)) return []
  try {
    const stored = await withStore<ImportedFile[] | undefined>(
      'readonly',
      store => store.get(key),
    )
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export const saveWorkspaceFiles = async (files: ImportedFile[]): Promise<void> => {
  const key = importedFilesKey()
  if (!key || typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<IDBValidKey>(
    'readwrite',
    store => store.put(files, key),
  )
}

export const clearWorkspaceFiles = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  await withStore<undefined>(
    'readwrite',
    store => store.clear(),
  )
}


const nfceKeyPrefix = () =>
  activeWorkspaceScope ? `nfce-xml-v1:${activeWorkspaceScope}:` : ''

const nfceKeyRange = () => {
  const prefix = nfceKeyPrefix()
  return prefix
    ? IDBKeyRange.bound(prefix, prefix + '\uffff')
    : null
}

export const loadNfceDocuments = async (): Promise<NfceSummary[]> => {
  const range = nfceKeyRange()
  if (!range || typeof window === 'undefined' || !('indexedDB' in window)) return []

  try {
    const stored = await withStore<NfceSummary[]>(
      'readonly',
      store => store.getAll(range),
      NFCE_STORE_NAME,
    )
    return Array.isArray(stored)
      ? stored.sort((left, right) => right.lastModified - left.lastModified)
      : []
  } catch {
    return []
  }
}

export const saveNfceDocuments = async (documents: NfceSummary[]): Promise<void> => {
  const prefix = nfceKeyPrefix()
  if (!prefix || documents.length === 0 || typeof window === 'undefined' || !('indexedDB' in window)) return

  const db = await openPrimeCheckDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(NFCE_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(NFCE_STORE_NAME)

      documents.forEach(document => {
        store.put(document, prefix + document.id)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao salvar XMLs NFC-e localmente.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Armazenamento local de XMLs interrompido.'))
    })
  } finally {
    db.close()
  }
}

export const clearNfceDocuments = async (): Promise<void> => {
  const range = nfceKeyRange()
  if (!range || typeof window === 'undefined' || !('indexedDB' in window)) return

  await withStore<undefined>(
    'readwrite',
    store => store.delete(range),
    NFCE_STORE_NAME,
  )
  clearNfceUiState()
}

export type NfceModalTab = 'danfe' | 'tags' | 'xml'
export type NfceStatusFilter = 'ALL' | 'AUTHORIZED' | 'ISSUES'
export type NfceSortKey = 'number' | 'issuer' | 'issueDate' | 'total' | 'status' | 'accessKey'
export type NfceSortDirection = 'asc' | 'desc'

export type NfceUiState = {
  selectedId: string | null
  modalOpen: boolean
  modalTab: NfceModalTab
  listSearch: string
  statusFilter: NfceStatusFilter
  sortKey: NfceSortKey
  sortDirection: NfceSortDirection
  page: number
  tagSearch: string
  selectedXmlKey: string | null
  expandedXmlKeys: string[]
  xmlTreeScrollTop: number
  modalScrollTop: number
  pageScrollY: number
}

const NFCE_UI_KEY_PREFIX = 'nfce-ui-v1'

const nfceUiKey = () =>
  activeWorkspaceScope ? `${NFCE_UI_KEY_PREFIX}:${activeWorkspaceScope}` : ''

const emptyNfceUiState = (): NfceUiState => ({
  selectedId: null,
  modalOpen: false,
  modalTab: 'danfe',
  listSearch: '',
  statusFilter: 'ALL',
  sortKey: 'issueDate',
  sortDirection: 'asc',
  page: 1,
  tagSearch: '',
  selectedXmlKey: null,
  expandedXmlKeys: ['0'],
  xmlTreeScrollTop: 0,
  modalScrollTop: 0,
  pageScrollY: 0,
})

const asString = (value: unknown) => typeof value === 'string' ? value : ''
const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const loadNfceUiState = (): NfceUiState => {
  const key = nfceUiKey()
  if (!hasLocalStorage() || !key) return emptyNfceUiState()

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return emptyNfceUiState()

    const parsed = JSON.parse(raw) as Partial<NfceUiState>
    const modalTab = parsed.modalTab === 'tags' || parsed.modalTab === 'xml' ? parsed.modalTab : 'danfe'
    const statusFilter = parsed.statusFilter === 'AUTHORIZED' || parsed.statusFilter === 'ISSUES'
      ? parsed.statusFilter
      : 'ALL'
    const sortKey: NfceSortKey =
      parsed.sortKey === 'number'
      || parsed.sortKey === 'issuer'
      || parsed.sortKey === 'total'
      || parsed.sortKey === 'status'
      || parsed.sortKey === 'accessKey'
        ? parsed.sortKey
        : 'issueDate'
    const sortDirection: NfceSortDirection = parsed.sortDirection === 'desc' ? 'desc' : 'asc'
    const expandedXmlKeys = Array.isArray(parsed.expandedXmlKeys)
      ? parsed.expandedXmlKeys.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : ['0']

    return {
      selectedId: typeof parsed.selectedId === 'string' && parsed.selectedId ? parsed.selectedId : null,
      modalOpen: Boolean(parsed.modalOpen),
      modalTab,
      listSearch: asString(parsed.listSearch),
      statusFilter,
      sortKey,
      sortDirection,
      page: Math.max(1, Math.floor(asNumber(parsed.page, 1))),
      tagSearch: asString(parsed.tagSearch),
      selectedXmlKey: typeof parsed.selectedXmlKey === 'string' && parsed.selectedXmlKey ? parsed.selectedXmlKey : null,
      expandedXmlKeys: expandedXmlKeys.length ? expandedXmlKeys : ['0'],
      xmlTreeScrollTop: Math.max(0, asNumber(parsed.xmlTreeScrollTop)),
      modalScrollTop: Math.max(0, asNumber(parsed.modalScrollTop)),
      pageScrollY: Math.max(0, asNumber(parsed.pageScrollY)),
    }
  } catch {
    return emptyNfceUiState()
  }
}

export const saveNfceUiState = (state: NfceUiState) => {
  const key = nfceUiKey()
  if (!hasLocalStorage() || !key) return
  window.localStorage.setItem(key, JSON.stringify(state))
}

export const clearNfceUiState = () => {
  const key = nfceUiKey()
  if (!hasLocalStorage() || !key) return
  window.localStorage.removeItem(key)
}
