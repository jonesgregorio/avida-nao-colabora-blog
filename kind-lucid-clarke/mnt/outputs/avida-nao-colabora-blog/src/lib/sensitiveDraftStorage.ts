const EXACT_SENSITIVE_DRAFT_KEYS = new Set([
  'contact_draft',
])

const SENSITIVE_DRAFT_PREFIXES = [
  'avnc-support-draft-',
  'avnc-guidance-draft-',
]

export function isSensitiveDraftKey(key: string): boolean {
  return EXACT_SENSITIVE_DRAFT_KEYS.has(key)
    || SENSITIVE_DRAFT_PREFIXES.some(prefix => key.startsWith(prefix))
}

function matchingKeys(storage: Storage, getItem: typeof Storage.prototype.getItem): string[] {
  const keys: string[] = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key && isSensitiveDraftKey(key) && getItem.call(storage, key) !== null) keys.push(key)
    }
  } catch { /* storage may be unavailable in hardened/private contexts */ }
  return keys
}

export function installSensitiveDraftStorageGuard(): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return

  const guardedWindow = window as Window & { __avncSensitiveDraftStorageGuardInstalled?: boolean }
  if (guardedWindow.__avncSensitiveDraftStorageGuardInstalled) return

  const local = window.localStorage
  const session = window.sessionStorage
  const prototype = Storage.prototype
  const nativeGetItem = prototype.getItem
  const nativeSetItem = prototype.setItem
  const nativeRemoveItem = prototype.removeItem

  // Migra qualquer rascunho sensível deixado por versões anteriores e remove
  // imediatamente a cópia persistente do localStorage.
  for (const key of matchingKeys(local, nativeGetItem)) {
    try {
      const value = nativeGetItem.call(local, key)
      if (value !== null && nativeGetItem.call(session, key) === null) {
        nativeSetItem.call(session, key, value)
      }
      nativeRemoveItem.call(local, key)
    } catch { /* noop */ }
  }

  prototype.getItem = function getItem(key: string): string | null {
    if (this === local && isSensitiveDraftKey(key)) {
      const legacyValue = nativeGetItem.call(local, key)
      if (legacyValue !== null) {
        if (nativeGetItem.call(session, key) === null) nativeSetItem.call(session, key, legacyValue)
        nativeRemoveItem.call(local, key)
      }
      return nativeGetItem.call(session, key)
    }
    return nativeGetItem.call(this, key)
  }

  prototype.setItem = function setItem(key: string, value: string): void {
    if (this === local && isSensitiveDraftKey(key)) {
      nativeRemoveItem.call(local, key)
      nativeSetItem.call(session, key, value)
      return
    }
    nativeSetItem.call(this, key, value)
  }

  prototype.removeItem = function removeItem(key: string): void {
    if (this === local && isSensitiveDraftKey(key)) {
      nativeRemoveItem.call(local, key)
      nativeRemoveItem.call(session, key)
      return
    }
    nativeRemoveItem.call(this, key)
  }

  guardedWindow.__avncSensitiveDraftStorageGuardInstalled = true
}

export function clearSensitiveDrafts(): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return

  const nativeRemoveItem = Storage.prototype.removeItem
  const nativeGetItem = Storage.prototype.getItem

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of matchingKeys(storage, nativeGetItem)) {
      try { nativeRemoveItem.call(storage, key) } catch { /* noop */ }
    }
  }
}
