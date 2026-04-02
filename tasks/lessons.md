# NetMigrate — Lessons Learned

## Session 1 (2026-04-03)

- `npm create electron-vite@latest` is interactive and can't be run non-interactively in CI/scripts. Build the project structure manually for full control.
- electron-vite uses `src/preload/` (not `src/main/preload.js`) as the preload source directory.
- IPC channel names should be in a shared constants file (`src/shared/ipcChannels.js`) — avoids string drift between main and renderer.
- Tailwind's `user-select: none` on `html/body` is correct for Electron apps; add `.selectable` class for input/text areas.
- Use `HashRouter` (not `BrowserRouter`) in Electron — file:// protocol doesn't support HTML5 history.
- electron-builder `build` config can live in `package.json` — no separate yml needed for simple cases.
- macOS traffic lights work with `trafficLightPosition` on `BrowserWindow` — no need to render them in React.
- Always store API keys via `safeStorage.encryptString()`, never in plain env vars or settings JSON.
