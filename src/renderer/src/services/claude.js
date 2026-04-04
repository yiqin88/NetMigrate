// Renderer-side Claude service — thin wrapper over IPC to main process
// All actual API calls happen in src/main/api/claude.js

export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [], kbMappings = [] }) {
  if (!window.electronAPI?.claude) throw new Error('App not ready — try again.')
  console.log('[claude] convertConfig via IPC — config:', sourceConfig.length, 'chars, kb:', kbMappings.length)
  return await window.electronAPI.claude.convert({ sourceConfig, sourceVendor, targetVendor, examples, kbMappings })
}

export async function testApiKey(apiKey) {
  if (!window.electronAPI?.claude) return { valid: false, error: 'App not ready' }
  console.log('[claude] testApiKey via IPC')
  return await window.electronAPI.claude.testKey(apiKey)
}
