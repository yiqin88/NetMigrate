import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupUpdater } from './updater'
import { setupSafeStorage, getSetting, setSetting, deleteSetting } from './settings'
import { IPC } from '../shared/ipcChannels'
import { convertConfig, testApiKey } from './api/claude'
import {
  getRecentMigrations, saveMigration, getMigrationStats,
  testConnection as testSupabaseConnection, resetClient as resetSupabaseClient,
} from './api/supabase'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false, // Custom frameless title bar
    backgroundColor: '#0f1117',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 14 }, // macOS traffic lights
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show window when ready to avoid white flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) mainWindow.webContents.openDevTools()
  })

  // Open external links in browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  console.log('[startup] Electron:', process.versions.electron)
  console.log('[startup] Node.js:', process.versions.node)
  console.log('[startup] Chrome:', process.versions.chrome)
  console.log('[startup] Platform:', process.platform, process.arch)
  electronApp.setAppUserModelId('com.netmigrate.app')

  // Default open/close DevTools behaviour in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupSafeStorage()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Check for updates after a short delay to let the UI settle
  setTimeout(() => {
    if (!is.dev) setupUpdater(mainWindow)
  }, 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: Window controls ──────────────────────────────────────────────────────

ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
  mainWindow?.minimize()
})

ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on(IPC.WINDOW_CLOSE, () => {
  mainWindow?.close()
})

ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => {
  return mainWindow?.isMaximized() ?? false
})

// ── IPC: File system ──────────────────────────────────────────────────────────

ipcMain.handle(IPC.FILE_OPEN, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Config Files', extensions: ['txt', 'cfg', 'conf', 'log'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled || filePaths.length === 0) return null

  const { readFile } = await import('fs/promises')
  const content = await readFile(filePaths[0], 'utf-8')
  return { path: filePaths[0], content }
})

ipcMain.handle(IPC.FILE_SAVE, async (_, { content, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'converted-config.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt', 'cfg', 'conf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled || !filePath) return false

  const { writeFile } = await import('fs/promises')
  await writeFile(filePath, content, 'utf-8')
  return true
})

// ── IPC: Settings / safeStorage ───────────────────────────────────────────────

ipcMain.handle(IPC.SETTINGS_GET, (_, key) => getSetting(key))
ipcMain.handle(IPC.SETTINGS_SET, (_, key, value) => setSetting(key, value))
ipcMain.handle(IPC.SETTINGS_DELETE, (_, key) => deleteSetting(key))

// electron-store handles persistence + basic encryption via encryptionKey.
// No more Electron safeStorage — it was unreliable across dev/prod restarts.
ipcMain.handle(IPC.SAFE_STORE_GET, (_, key) => {
  const val = getSetting(`__safe_${key}`)
  console.log(`[safeStore] GET __safe_${key} →`, val ? '(has value)' : 'null')
  return val ?? null
})

ipcMain.handle(IPC.SAFE_STORE_SET, (_, key, value) => {
  console.log(`[safeStore] SET __safe_${key}`)
  setSetting(`__safe_${key}`, value)
})

ipcMain.handle(IPC.SAFE_STORE_DELETE, (_, key) => {
  deleteSetting(`__safe_${key}`)
})

// ── IPC: Claude API (main process) ────────────────────────────────────────────

ipcMain.handle(IPC.CLAUDE_CONVERT, async (event, payload) => {
  try {
    return await convertConfig(payload, (progress) => {
      // Send streaming progress to renderer
      event.sender.send(IPC.CLAUDE_CONVERT_PROGRESS, progress)
    })
  } catch (err) {
    throw new Error(err.message)
  }
})

ipcMain.handle(IPC.CLAUDE_TEST_KEY, async (_, apiKey) => {
  return await testApiKey(apiKey)
})

// ── IPC: Supabase (main process) ──────────────────────────────────────────────

ipcMain.handle(IPC.SUPABASE_GET_MIGRATIONS, async (_, payload) => {
  return await getRecentMigrations(payload)
})

ipcMain.handle(IPC.SUPABASE_SAVE_MIGRATION, async (_, record) => {
  return await saveMigration(record)
})

ipcMain.handle(IPC.SUPABASE_GET_STATS, async () => {
  return await getMigrationStats()
})

ipcMain.handle(IPC.SUPABASE_TEST_CONNECTION, async () => {
  return await testSupabaseConnection()
})

ipcMain.handle(IPC.SUPABASE_RESET, () => {
  resetSupabaseClient()
})
