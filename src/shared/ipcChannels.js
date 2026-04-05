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
  CLAUDE_CONVERT_PROGRESS: 'claude:convert-progress',
  CLAUDE_TEST_KEY: 'claude:test-key',
  CLAUDE_DETECT_VENDOR: 'claude:detect-vendor',

  // Supabase (main process)
  SUPABASE_GET_MIGRATIONS: 'supabase:get-migrations',
  SUPABASE_SAVE_MIGRATION: 'supabase:save-migration',
  SUPABASE_GET_STATS: 'supabase:get-stats',
  SUPABASE_TEST_CONNECTION: 'supabase:test-connection',
  SUPABASE_RESET: 'supabase:reset',

  // Training examples (main process → Supabase)
  TRAINING_LIST: 'training:list',
  TRAINING_SAVE: 'training:save',
  TRAINING_UPDATE: 'training:update',
  TRAINING_DELETE: 'training:delete',
  TRAINING_COUNT: 'training:count',
  TRAINING_GET_EXAMPLES: 'training:get-examples',
  TRAINING_EXTRACT_MAPPINGS: 'training:extract-mappings',

  // Custom vendors/products (Supabase sync)
  CUSTOM_VENDORS_LIST: 'custom:vendors-list',
  CUSTOM_VENDORS_SAVE: 'custom:vendors-save',
  CUSTOM_VENDORS_DELETE: 'custom:vendors-delete',
  CUSTOM_PRODUCTS_LIST: 'custom:products-list',
  CUSTOM_PRODUCTS_SAVE: 'custom:products-save',
  CUSTOM_PRODUCTS_UPDATE: 'custom:products-update',
  CUSTOM_PRODUCTS_DELETE: 'custom:products-delete',
  DEVICE_TYPES_LIST: 'device-types:list',
  DEVICE_TYPES_SAVE: 'device-types:save',

  // Knowledge Base
  KB_LIST: 'kb:list',
  KB_SAVE_BATCH: 'kb:save-batch',
  KB_UPDATE: 'kb:update',
  KB_DELETE: 'kb:delete',
  KB_STATS: 'kb:stats',
  KB_GET_FOR_CONVERSION: 'kb:get-for-conversion',
  KB_EXPORT_CSV: 'kb:export-csv',
  KB_ANALYSE_DOCS: 'kb:analyse-docs',
  KB_ANALYSE_DOCS_PROGRESS: 'kb:analyse-docs-progress',
  KB_ANALYSE_WEB: 'kb:analyse-web',
  KB_ANALYSE_WEB_PROGRESS: 'kb:analyse-web-progress',

  // Setup wizard
  SETUP_VALIDATE_INVITE: 'setup:validate-invite',
}
