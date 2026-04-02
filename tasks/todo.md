# NetMigrate — Task Tracker

## Session 1: Project Setup & UI Layout ✅

- [x] Initialize electron-vite project with React template
- [x] Install all dependencies (Tailwind, Supabase, Anthropic, recharts, monaco, react-diff-viewer)
- [x] Configure Tailwind CSS v3 with dark mode
- [x] Configure electron-builder (macOS dmg + Windows nsis + GitHub auto-update)
- [x] Electron main process: BrowserWindow (frameless), file open/save dialogs
- [x] Electron preload: contextBridge IPC API (window, file, settings, safeStore, updater)
- [x] electron-updater integration with GitHub releases
- [x] Secure settings storage (electron safeStorage for API keys)
- [x] Shared IPC channel constants
- [x] App entry HTML + React root
- [x] Global Tailwind CSS with custom dark theme tokens
- [x] Custom Tailwind component classes (btn-primary, card, input, badges)
- [x] AppShell layout (TitleBar + Sidebar + content area)
- [x] TitleBar: custom frameless, macOS traffic lights, Windows controls
- [x] Sidebar: nav links (Migrate / Dashboard / Settings) with icons
- [x] React Router with HashRouter + 3 routes
- [x] MigratePage: 5-step wizard shell with step indicator
- [x] DashboardPage: stat cards + chart placeholder
- [x] SettingsPage: API key + Supabase config form with safeStorage
- [x] VendorSelector: source/target card picker with feature chips
- [x] vendors.js constants: Cisco IOS + Aruba CX definitions
- [x] Services stubs: claude.js, supabase.js, configParser.js
- [x] Hooks stubs: useConversion.js, useMigrations.js
- [x] UpdateDialog: auto-update notification with progress bar
- [x] Git init + push to GitHub
- [x] .gitignore, .env.example

## Session 2: Config Input & Parser (TODO)

- [ ] ConfigInput component: textarea paste + drag-drop file upload
- [ ] File upload via electronAPI.file.open()
- [ ] parseCiscoConfig() integration into ConfigPreview
- [ ] ConfigPreview component: tabbed view (VLANs / Interfaces / Routing / STP)
- [ ] Wire up MigratePage step 2 (input) and step 3 (preview)

## Session 3: Claude Conversion & Diff View (TODO)

- [ ] Call claude.js convertConfig() from useConversion hook
- [ ] DiffView component with react-diff-viewer-continued
- [ ] WarningsPanel component with severity filtering
- [ ] Wire up MigratePage step 4 (diff + warnings)
- [ ] Manual edit mode for converted config (Monaco Editor)

## Session 4: Approve, Save & Export (TODO)

- [ ] RatingModal: 1-5 star accuracy rating
- [ ] approveMigration() saves to Supabase
- [ ] Export to .txt file via electronAPI.file.save()
- [ ] Copy to clipboard button
- [ ] Wire up MigratePage step 5 (complete)

## Session 5: Dashboard & Supabase (TODO)

- [ ] Create Supabase migrations table (schema + RLS)
- [ ] AccuracyChart component with recharts
- [ ] DashboardPage: populate real stats + chart from useMigrations hook
- [ ] Migration history table

## Session 6: Polish & Build (TODO)

- [ ] Vendor SVG logos in VendorSelector
- [ ] Error handling and loading states across all pages
- [ ] Build and test on macOS (dmg)
- [ ] Build and test on Windows (nsis)
- [ ] Test auto-updater flow end-to-end
