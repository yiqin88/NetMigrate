// IPC channel name constants shared between main and renderer processes

export const IPC = {
  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // File system
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',

  // Auto-updater
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
  UPDATE_PROGRESS: 'update:progress',

  // Settings / secure storage
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_DELETE: 'settings:delete',

  // Secure key storage (electron-store)
  SAFE_STORE_GET: 'safeStore:get',
  SAFE_STORE_SET: 'safeStore:set',
  SAFE_STORE_DELETE: 'safeStore:delete',

  // Claude API (main process)
  CLAUDE_CONVERT: 'claude:convert',
  CLAUDE_TEST_KEY: 'claude:test-key',

  // Supabase (main process)
  SUPABASE_GET_MIGRATIONS: 'supabase:get-migrations',
  SUPABASE_SAVE_MIGRATION: 'supabase:save-migration',
  SUPABASE_GET_STATS: 'supabase:get-stats',
  SUPABASE_TEST_CONNECTION: 'supabase:test-connection',
  SUPABASE_RESET: 'supabase:reset',
}
