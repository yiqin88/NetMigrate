import { autoUpdater } from 'electron-updater'
import { IPC } from '../shared/ipcChannels'

export function setupUpdater(mainWindow) {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  autoUpdater.on('update-available', (info) => {
    send(IPC.UPDATE_AVAILABLE, info)
  })

  autoUpdater.on('update-not-available', (info) => {
    send(IPC.UPDATE_NOT_AVAILABLE, info)
  })

  autoUpdater.on('download-progress', (progress) => {
    send(IPC.UPDATE_PROGRESS, progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    send(IPC.UPDATE_DOWNLOADED, info)
  })

  autoUpdater.on('error', (err) => {
    send(IPC.UPDATE_ERROR, err?.message ?? 'Unknown update error')
  })

  // Silent check on startup
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] check failed:', err?.message)
  })
}
