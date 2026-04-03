// Renderer-side Claude service — thin wrapper over IPC to main process
// All actual API calls happen in src/main/api/claude.js

export async function convertConfig({ sourceConfig, sourceVendor, targetVendor, examples = [] }) {
  console.log('[claude] convertConfig via IPC — config:', sourceConfig.length, 'chars')
  return await window.electronAPI.claude.convert({ sourceConfig, sourceVendor, targetVendor, examples })
}

export async function testApiKey(apiKey) {
  console.log('[claude] testApiKey via IPC')
  return await window.electronAPI.claude.testKey(apiKey)
}
