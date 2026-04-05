import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupUpdater, checkForUpdates, downloadUpdate, installUpdate } from './updater'
import { setupSafeStorage, getSetting, setSetting, deleteSetting } from './settings'
import { IPC } from '../shared/ipcChannels'
import { convertConfig, testApiKey, extractCommandMappings, detectConfigVendor, analyseDocuments, analyseWebSearch, CATEGORIES } from './api/claude'
import { listKBEntries, saveBatchKBEntries, updateKBEntry, deleteKBEntry, getKBStats, getKBForConversion, exportKBAsCSV } from './api/knowledgeBase'
import {
  getRecentMigrations, saveMigration, getMigrationStats,
  testConnection as testSupabaseConnection, resetClient as resetSupabaseClient,
  listTrainingExamples, saveTrainingExample, updateTrainingExample,
  deleteTrainingExample, getTrainingExampleCounts, getTrainingExamplesForConversion,
  listCustomVendors, saveCustomVendor, deleteCustomVendor,
  listCustomProducts, saveCustomProduct, updateCustomProduct, deleteCustomProduct,
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

  // Ensure DB schema is up to date
  import('./api/supabase.js').then((m) => m.ensureSchema()).catch(() => {})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // ── Application menu ──────────────────────────────────────────────────────
  const menuTemplate = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ]
    }] : []),
    { role: 'editMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (is.dev) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Development Mode',
                message: 'Update checking is disabled in development mode.',
                buttons: ['OK'],
              })
            } else {
              checkForUpdates('menu').catch((err) => {
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: 'Update Error',
                  message: 'Could not check for updates. Please check your internet connection.',
                  detail: err?.message ?? 'Unknown error',
                  buttons: ['OK'],
                })
              })
            }
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

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

// ── IPC: Auto-updater ────────────────────────────────────────────────────────

ipcMain.handle(IPC.UPDATE_CHECK, () => checkForUpdates('renderer'))
ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => downloadUpdate())
ipcMain.handle(IPC.UPDATE_INSTALL, () => installUpdate())

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

// ── IPC: Training examples ────────────────────────────────────────────────────

ipcMain.handle(IPC.TRAINING_LIST, async (_, payload) => {
  return await listTrainingExamples(payload)
})

ipcMain.handle(IPC.TRAINING_SAVE, async (_, record) => {
  return await saveTrainingExample(record)
})

ipcMain.handle(IPC.TRAINING_UPDATE, async (_, { id, updates }) => {
  return await updateTrainingExample(id, updates)
})

ipcMain.handle(IPC.TRAINING_DELETE, async (_, id) => {
  return await deleteTrainingExample(id)
})

ipcMain.handle(IPC.TRAINING_COUNT, async () => {
  return await getTrainingExampleCounts()
})

ipcMain.handle(IPC.TRAINING_GET_EXAMPLES, async (_, payload) => {
  return await getTrainingExamplesForConversion(payload)
})

ipcMain.handle(IPC.TRAINING_EXTRACT_MAPPINGS, async (_, payload) => {
  return await extractCommandMappings(payload)
})

// ── IPC: Claude config detection ──────────────────────────────────────────────

ipcMain.handle(IPC.CLAUDE_DETECT_VENDOR, async (_, configText) => {
  return await detectConfigVendor(configText)
})

// ── IPC: Custom vendors/products ──────────────────────────────────────────────

ipcMain.handle(IPC.CUSTOM_VENDORS_LIST, async () => await listCustomVendors())
ipcMain.handle(IPC.CUSTOM_VENDORS_SAVE, async (_, record) => await saveCustomVendor(record))
ipcMain.handle(IPC.CUSTOM_VENDORS_DELETE, async (_, id) => await deleteCustomVendor(id))
ipcMain.handle(IPC.CUSTOM_PRODUCTS_LIST, async () => await listCustomProducts())
ipcMain.handle(IPC.CUSTOM_PRODUCTS_SAVE, async (_, record) => await saveCustomProduct(record))
ipcMain.handle(IPC.CUSTOM_PRODUCTS_UPDATE, async (_, { id, updates }) => await updateCustomProduct(id, updates))
ipcMain.handle(IPC.CUSTOM_PRODUCTS_DELETE, async (_, id) => await deleteCustomProduct(id))

// ── IPC: Knowledge Base ───────────────────────────────────────────────────────

ipcMain.handle(IPC.KB_LIST, async (_, payload) => await listKBEntries(payload))
ipcMain.handle(IPC.KB_SAVE_BATCH, async (_, entries) => await saveBatchKBEntries(entries))
ipcMain.handle(IPC.KB_UPDATE, async (_, { id, updates }) => await updateKBEntry(id, updates))
ipcMain.handle(IPC.KB_DELETE, async (_, id) => await deleteKBEntry(id))
ipcMain.handle(IPC.KB_STATS, async () => await getKBStats())
ipcMain.handle(IPC.KB_GET_FOR_CONVERSION, async (_, payload) => await getKBForConversion(payload))
ipcMain.handle(IPC.KB_EXPORT_CSV, async (_, payload) => {
  const entries = await listKBEntries(payload)
  return exportKBAsCSV(entries)
})

ipcMain.handle(IPC.KB_ANALYSE_DOCS, async (event, { sourceDoc, targetDoc, sourceProduct, targetProduct, categories }) => {
  const cats = categories ?? CATEGORIES
  const results = {}
  for (const cat of cats) {
    const mappings = await analyseDocuments(
      { sourceDoc, targetDoc, sourceProduct, targetProduct, category: cat },
      (progress) => event.sender.send(IPC.KB_ANALYSE_DOCS_PROGRESS, progress)
    )
    results[cat] = mappings
  }
  return results
})

ipcMain.handle(IPC.KB_ANALYSE_WEB, async (event, { sourceProduct, targetProduct, categories }) => {
  const cats = categories ?? CATEGORIES
  const results = {}
  for (const cat of cats) {
    const result = await analyseWebSearch(
      { sourceProduct, targetProduct, category: cat },
      (progress) => event.sender.send(IPC.KB_ANALYSE_WEB_PROGRESS, progress)
    )
    results[cat] = result
  }
  return results
})
