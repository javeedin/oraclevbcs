# Maintenance desktop client

An [Electron](https://www.electronjs.org/) shell around the Maintenance Visual Builder app. It is
not part of the VB application: VB Studio ignores this folder.

## How it works

```
Maintenance.exe
├── main.js          main process: window, tray, menus, global shortcut, notifications, updates,
│                    and the Claude API call (net.fetch) with the key from secure storage
├── preload.js       window.mxDesktop for the page (sandboxed, contextIsolation): never the key
├── lib/server.js    serves app/ on http://localhost:18888 (127.0.0.1 only), like grunt vb-serve
├── lib/store.js     settings.json and the key (safeStorage: Windows DPAPI, macOS Keychain)
└── app/             the built VB app, filled by scripts/build-app.js (not in Git)
```

The web app finds `window.mxDesktop` in `app-flow.js` (`DESKTOP`) and then:

- keeps the Claude key in the desktop app (Settings saves it there; the page only gets a hint) and
  sends Auto Pilot's requests through `mxDesktop.claude()`;
- sends the counts after every change (`setCounts`): taskbar overlay badge and tray tooltip;
- asks for a notification when Auto Pilot answers while the window is in the background;
- receives tray, menu and Ctrl+Shift+Space commands (`onCommand`) and turns them into shell events
  (`mxcommand`, `mxask` on `#mxBridge`);
- hides the header's **Download desktop app** button.

The main process only answers IPC from the app's own origin, checks every Claude request body
(model name, max_tokens, messages), opens other links in the default browser, and keeps the page
away from Node (sandbox, contextIsolation, no nodeIntegration).

## Build and run

From the repository folder (Node 20):

```powershell
npm install                  # Oracle's VB build tools
npm run build:desktop        # npm run build, then scripts/build-app.js:
                             #   starts grunt vb-serve on port 18888, copies build/processed/webApps/maint
                             #   to desktop/app, saves index.html as vb-serve sends it, stops the server
cd desktop
npm install
npm start                    # run it
npm run dist                 # Windows installer: dist/Maintenance-Setup.exe
```

`settings.json` (File > Desktop settings…, in `%APPDATA%\Maintenance`):

| Setting | Default | |
|---|---|---|
| `serverUrl` | `""` | empty: the bundled app; or the URL of the app hosted in VB Studio |
| `closeToTray` | `false` | keep running in the tray when the window closes |
| `autoUpdate` | `true` | check GitHub releases at start |
| `globalShortcut` | `CommandOrControl+Shift+Space` | opens Auto Pilot from anywhere |

## Smoke test

```bash
MX_SELFTEST=1 MX_SELFTEST_APP=1 MX_CLAUDE_URL=http://127.0.0.1:18999/v1/messages \
  xvfb-run -a npx electron . --no-sandbox
```

`scripts/selftest.js` starts a mock Claude API on that URL, then checks the bridge, the key store,
the Claude call from the main process, the header count (not 0) and the tray badge, tray commands
(navigate, open Auto Pilot) and a real Auto Pilot question through the app. Without
`MX_SELFTEST_APP` it checks only the bridge, against any page (`MX_APP_DIR=<folder>`).
`MX_SELFTEST` and `MX_CLAUDE_URL` are ignored in the installed app.

## Releases

`.github/workflows/desktop.yml` runs on every push that touches the app or this folder: Linux
builds the VB app and runs the smoke test with the real app; Windows packages the installer
(downloadable from the run). On a `v*` tag matching `version` in `package.json`, it publishes a
GitHub release with `Maintenance-Setup.exe` and `latest.yml`, which the header button and
electron-updater use.

The installer is not code-signed. To sign it, add a certificate as the `CSC_LINK` and
`CSC_KEY_PASSWORD` secrets and pass them to the Windows job; electron-builder signs automatically.
