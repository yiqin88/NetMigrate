import Store from 'electron-store'

let store

export function setupSafeStorage() {
  store = new Store({
    name: 'netmigrate-settings',
    encryptionKey: 'netmigrate-v1', // basic obfuscation for on-disk JSON
  })
  console.log('[settings] store path:', store.path)
}

export function getSetting(key) {
  return store?.get(key) ?? null
}

export function setSetting(key, value) {
  store?.set(key, value)
}

export function deleteSetting(key) {
  store?.delete(key)
}
