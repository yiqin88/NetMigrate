import { dialog } from 'electron'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { IPC } from '../shared/ipcChannels'
import { setSetting } from './settings'

// Build-time GitHub PAT for private repo update checks
const GH_PAT = process.env.VITE_GH_PAT || ''
console.log('[updater] GH_PAT length:', GH_PAT.length, 'prefix:', GH_PAT.slice(0, 4) || '(empty)')

let mainWin = null
let checkSource = 'silent' // 'silent' | 'menu' | 'renderer'
let isChecking = false

function send(channel, data) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data)
  }
}

function recordCheckTime() {
  setSetting('update_last_checked', new Date().toISOString())
}

export function setupUpdater(window) {
  mainWin = window
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  if (GH_PAT) {
    autoUpdater.requestHeaders = { Authorization: `token ${GH_PAT}` }
    console.log('[updater] requestHeaders set with token')
  } else {
    console.warn('[updater] WARNING: GH_PAT is empty — private repo updates will 404')
  }

  console.log('[updater] feedURL config:', JSON.stringify(autoUpdater.currentUpdater?.resolveFiles || 'N/A'))
  console.log('[updater] app version:', autoUpdater.currentVersion?.version)

  autoUpdater.on('update-available', async (info) => {
    recordCheckTime()
    if (checkSource === 'menu') {
      checkSource = 'silent'
      const { response } = await dialog.showMessageBox(mainWin, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Download now?`,
        detail: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
      })
      if (response === 0) autoUpdater.downloadUpdate()
      return
    }
    checkSource = 'silent'
    send(IPC.UPDATE_AVAILABLE, info)
  })

  autoUpdater.on('update-not-available', (info) => {
    recordCheckTime()
    if (checkSource === 'menu') {
      checkSource = 'silent'
      dialog.showMessageBox(mainWin, {
        type: 'info',
        title: 'No Updates',
        message: `You are on the latest version (v${info.version}).`,
        buttons: ['OK'],
      })
      return
    }
    checkSource = 'silent'
    send(IPC.UPDATE_NOT_AVAILABLE, info)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message, err?.stack)
    if (checkSource === 'menu') {
      checkSource = 'silent'
      dialog.showMessageBox(mainWin, {
        type: 'error',
        title: 'Update Error',
        message: 'Could not check for updates. Please check your internet connection.',
        detail: err?.message ?? 'Unknown error',
        buttons: ['OK'],
      })
      return
    }
    checkSource = 'silent'
    send(IPC.UPDATE_ERROR, err?.message ?? 'Unknown update error')
  })

  autoUpdater.on('download-progress', (progress) => {
    send(IPC.UPDATE_PROGRESS, progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    send(IPC.UPDATE_DOWNLOADED, info)
  })

  // Silent check on startup
  checkSource = 'silent'
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] check failed:', err?.message)
  })
}

export async function checkForUpdates(source = 'renderer') {
  if (isChecking) return null
  isChecking = true
  checkSource = source
  try {
    return await autoUpdater.checkForUpdates()
  } catch (err) {
    checkSource = 'silent'
    throw err
  } finally {
    isChecking = false
  }
}

export function downloadUpdate() {
  return autoUpdater.downloadUpdate()
}

export function installUpdate() {
  autoUpdater.quitAndInstall()
}
