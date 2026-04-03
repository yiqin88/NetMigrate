import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupUpdater } from './updater'
import { setupSafeStorage, getSetting, setSetting, deleteSetting } from './settings'
import { IPC } from '../shared/ipcChannels'

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
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show window when ready to avoid white flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

ipcMain.handle(IPC.SAFE_STORE_GET, (_, key) => {
  const stored = getSetting(`__safe_${key}`)
  if (!stored) return null

  // If stored as encrypted (object with __encrypted flag), decrypt it
  if (typeof stored === 'object' && stored.__encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.data, 'base64'))
    } catch (err) {
      console.error('[safeStore] decrypt failed:', err.message)
      return null
    }
  }

  // Legacy format: raw base64-encoded encrypted string (old code stored this before the format change)
  if (typeof stored === 'string') {
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'))
    } catch {
      // Not encrypted — treat as plaintext
      return stored
    }
  }

  return null
})

ipcMain.handle(IPC.SAFE_STORE_SET, (_, key, value) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      setSetting(`__safe_${key}`, {
        __encrypted: true,
        data: encrypted.toString('base64'),
      })
    } else {
      // Fallback: store plaintext (with console warning)
      console.warn('[safeStore] encryption not available — storing plaintext')
      setSetting(`__safe_${key}`, value)
    }
  } catch (err) {
    console.error('[safeStore] set failed:', err.message)
    // Fallback: store plaintext so the app still works
    setSetting(`__safe_${key}`, value)
  }
})

ipcMain.handle(IPC.SAFE_STORE_DELETE, (_, key) => {
  deleteSetting(`__safe_${key}`)
})
