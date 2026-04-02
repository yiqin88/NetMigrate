import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

let settingsPath
let settings = {}

export function setupSafeStorage() {
  settingsPath = join(app.getPath('userData'), 'settings.json')
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    } catch {
      settings = {}
    }
  }
}

function persist() {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function getSetting(key) {
  return settings[key] ?? null
}

export function setSetting(key, value) {
  settings[key] = value
  persist()
}

export function deleteSetting(key) {
  delete settings[key]
  persist()
}
