import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'

// Expose a typed API to the renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window controls ───────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
  },

  // ── File system ───────────────────────────────────────────────────────────
  file: {
    open: () => ipcRenderer.invoke(IPC.FILE_OPEN),
    save: (payload) => ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    get: (key) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
    delete: (key) => ipcRenderer.invoke(IPC.SETTINGS_DELETE, key),
  },

  // ── Secure storage (API keys via electron-store) ──────────────────────────
  safeStore: {
    get: (key) => ipcRenderer.invoke(IPC.SAFE_STORE_GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC.SAFE_STORE_SET, key, value),
    delete: (key) => ipcRenderer.invoke(IPC.SAFE_STORE_DELETE, key),
  },

  // ── Claude API (calls go through main process) ──────────��─────────────────
  claude: {
    convert: (payload) => ipcRenderer.invoke(IPC.CLAUDE_CONVERT, payload),
    testKey: (apiKey) => ipcRenderer.invoke(IPC.CLAUDE_TEST_KEY, apiKey),
    onConvertProgress: (cb) => {
      const handler = (_, data) => cb(data)
      ipcRenderer.on(IPC.CLAUDE_CONVERT_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.CLAUDE_CONVERT_PROGRESS, handler)
    },
  },

  // ── Supabase (calls go through main process) ─────────────────────────────
  supabase: {
    getRecentMigrations: (payload) => ipcRenderer.invoke(IPC.SUPABASE_GET_MIGRATIONS, payload),
    saveMigration: (record) => ipcRenderer.invoke(IPC.SUPABASE_SAVE_MIGRATION, record),
    getStats: () => ipcRenderer.invoke(IPC.SUPABASE_GET_STATS),
    testConnection: () => ipcRenderer.invoke(IPC.SUPABASE_TEST_CONNECTION),
    reset: () => ipcRenderer.invoke(IPC.SUPABASE_RESET),
  },

  // ── Training examples (calls go through main process) ─────────────────────
  training: {
    list: (payload) => ipcRenderer.invoke(IPC.TRAINING_LIST, payload),
    save: (record) => ipcRenderer.invoke(IPC.TRAINING_SAVE, record),
    delete: (id) => ipcRenderer.invoke(IPC.TRAINING_DELETE, id),
    counts: () => ipcRenderer.invoke(IPC.TRAINING_COUNT),
    getExamples: (payload) => ipcRenderer.invoke(IPC.TRAINING_GET_EXAMPLES, payload),
  },

  // ── Auto-updater ──────────────────────────────────────────────────────────
  updater: {
    download: () => ipcRenderer.invoke(IPC.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
    onUpdateAvailable: (cb) => ipcRenderer.on(IPC.UPDATE_AVAILABLE, (_, info) => cb(info)),
    onUpdateDownloaded: (cb) => ipcRenderer.on(IPC.UPDATE_DOWNLOADED, (_, info) => cb(info)),
    onProgress: (cb) => ipcRenderer.on(IPC.UPDATE_PROGRESS, (_, progress) => cb(progress)),
    onError: (cb) => ipcRenderer.on(IPC.UPDATE_ERROR, (_, msg) => cb(msg)),
  },
})
