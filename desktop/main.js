'use strict';

/**
 * Maintenance desktop client (Electron).
 *
 * Shows the Maintenance Visual Builder app in its own window and adds what a browser can't:
 *  - the Claude API key in the operating system's secure storage, with Auto Pilot's calls to
 *    Claude made here in the main process (the key never reaches the web page);
 *  - a tray icon and a taskbar badge with the approvals waiting;
 *  - desktop notifications (work order created, work completed, Auto Pilot answered);
 *  - a global shortcut that opens Auto Pilot from anywhere (Ctrl+Shift+Space);
 *  - automatic updates from the GitHub releases of this repository.
 *
 * The app it shows is either the built app bundled in app/ (default) or the URL of the app
 * hosted in Visual Builder (settings.json > serverUrl).
 */
const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  Notification,
  globalShortcut,
  ipcMain,
  nativeImage,
  net,
  shell,
  dialog,
} = require('electron');
const server = require('./lib/server');
const { settings, key } = require('./lib/store');

const APP_ID = 'com.javeedin.maintenance';
const APP_PORT = 18888; // the port the bundled app is captured on (npm run build:desktop)
const CLAUDE_URL = (!app.isPackaged && process.env.MX_CLAUDE_URL) || 'https://api.anthropic.com/v1/messages';
const RELEASES_URL = 'https://github.com/javeedin/oraclevbcs/releases';
const SELFTEST = !app.isPackaged && process.env.MX_SELFTEST === '1';

let win = null;
let tray = null;
let appUrl = '';
let allowedOrigins = new Set();
let lastCounts = { pending: 0, drafts: 0, equipmentDown: 0, workOrdersActive: 0 };
let quitting = false;
const selftestLog = [];

const asset = (...p) => path.join(__dirname, 'assets', ...p);

/* ---------------------------------------------------------------------------
 * Window and app content
 * ------------------------------------------------------------------------- */

async function resolveAppUrl() {
  const s = settings.read();
  if (s.serverUrl && /^https?:\/\//i.test(s.serverUrl)) {
    return s.serverUrl;
  }
  const root = process.env.MX_APP_DIR || path.join(__dirname, 'app');
  const onMiss = SELFTEST ? (status, file) => console.log(`server: ${status} ${file}`) : null;
  const { port } = await server.start(root, APP_PORT, onMiss);
  // localhost, like grunt vb-serve: the built index.html is captured from it (desktop/scripts/build-app.js).
  return `http://localhost:${port}/`;
}

function isAllowed(url) {
  try {
    return allowedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function senderAllowed(event) {
  const frameUrl = event.senderFrame ? event.senderFrame.url : '';
  return isAllowed(frameUrl);
}

function createWindow() {
  const s = settings.read();
  const bounds = s.bounds || { width: 1440, height: 900 };
  win = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 640,
    title: `Maintenance ${app.getVersion()}`,
    icon: asset(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#f5f4f2',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // The page sets its own title ("Home", "Requests", ...): show it with the app name and version.
  win.on('page-title-updated', (event, title) => {
    event.preventDefault();
    const name = `Maintenance ${app.getVersion()}`;
    win.setTitle(title && title !== name ? `${title} - ${name}` : name);
  });

  win.once('ready-to-show', () => {
    if (!SELFTEST) {
      win.show();
    }
  });

  // Links to other sites open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) {
      return { action: 'allow' };
    }
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowed(url)) {
      return;
    }
    // A hosted app may need to go through its sign-in pages; the bundled app never leaves its origin.
    if (settings.read().serverUrl && /^https:\/\//i.test(url)) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
  });

  win.on('close', (event) => {
    settings.write({ bounds: win.getBounds() });
    if (!quitting && settings.read().closeToTray && tray) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });

  if (SELFTEST) {
    // Smoke test: report failed requests and page errors (desktop/scripts/selftest.js).
    win.webContents.session.webRequest.onCompleted((d) => {
      if (d.statusCode >= 400 && !d.url.startsWith(CLAUDE_URL)) {
        selftestLog.push(`HTTP ${d.statusCode} ${d.url}`);
      }
    });
    win.webContents.session.webRequest.onErrorOccurred((d) => {
      selftestLog.push(`${d.error} ${d.url}`);
    });
    win.webContents.on('console-message', (e, ...args) => {
      const level = e && e.level !== undefined ? e.level : args[0];
      const message = e && e.message !== undefined ? e.message : args[1];
      if (level === 'error' || level === 3) {
        selftestLog.push(`console: ${String(message).slice(0, 500)}`);
      }
    });
  }

  win.loadURL(appUrl);
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

/** Tells the web app to do something: open Auto Pilot, go to a page, open settings. */
function sendCommand(command) {
  showWindow();
  if (win) {
    win.webContents.send('mx:command', command);
  }
}

/* ---------------------------------------------------------------------------
 * Tray, taskbar badge and menus
 * ------------------------------------------------------------------------- */

function badgeImage(count) {
  if (!count) {
    return null;
  }
  const name = count > 9 ? '9plus' : String(count);
  return nativeImage.createFromPath(asset('badges', `${name}.png`));
}

function updateBadge(counts) {
  lastCounts = Object.assign({}, lastCounts, counts);
  const pending = Number(lastCounts.pending) || 0;
  const label = pending === 1 ? '1 approval waiting' : `${pending} approvals waiting`;
  if (process.platform === 'win32' && win) {
    win.setOverlayIcon(badgeImage(pending), pending ? label : '');
  } else {
    try {
      app.setBadgeCount(pending);
    } catch {
      // not supported on this desktop
    }
  }
  if (tray) {
    tray.setToolTip(`Maintenance · ${label}`);
    tray.setContextMenu(trayMenu());
  }
}

function goMenu() {
  const go = (label, flow, accelerator) => ({ label, accelerator, click: () => sendCommand({ command: 'navigate', flow }) });
  return [
    go('Home', 'home', 'CommandOrControl+1'),
    go('Dashboard', 'dashboard', 'CommandOrControl+2'),
    go('Requests', 'requests', 'CommandOrControl+3'),
    go('Equipment', 'equipment', 'CommandOrControl+4'),
    go('Approvals', 'inbox', 'CommandOrControl+5'),
    go('Work orders', 'workorders', 'CommandOrControl+6'),
    { type: 'separator' },
    { label: 'Auto Pilot', accelerator: settings.read().globalShortcut || undefined, click: () => sendCommand({ command: 'autopilot' }) },
    { label: 'Auto Pilot settings…', click: () => sendCommand({ command: 'settings' }) },
  ];
}

function trayMenu() {
  const c = lastCounts;
  return Menu.buildFromTemplate([
    { label: 'Open Maintenance', click: showWindow },
    { label: 'Ask Auto Pilot', click: () => sendCommand({ command: 'autopilot' }) },
    { type: 'separator' },
    { label: `Approvals waiting: ${c.pending || 0}`, click: () => sendCommand({ command: 'navigate', flow: 'inbox' }) },
    { label: `Drafts not sent: ${c.drafts || 0}`, click: () => sendCommand({ command: 'navigate', flow: 'requests' }) },
    { label: `Equipment down: ${c.equipmentDown || 0}`, click: () => sendCommand({ command: 'navigate', flow: 'equipment' }) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(asset('tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Maintenance');
  tray.setContextMenu(trayMenu());
  tray.on('click', showWindow);
}

function openDesktopSettings() {
  const file = settings.ensureFile();
  shell.openPath(file);
  dialog.showMessageBox({
    type: 'info',
    title: 'Desktop settings',
    message: 'The desktop settings file is open in your editor.',
    detail: [
      'serverUrl: leave empty for the app bundled in the desktop client, or paste the URL of the app hosted in Visual Builder.',
      'closeToTray: true keeps Maintenance running in the tray when you close the window.',
      'autoUpdate: false stops automatic updates.',
      'globalShortcut: the shortcut that opens Auto Pilot (default Ctrl+Shift+Space).',
      '',
      'Restart Maintenance after saving the file.',
    ].join('\n'),
  });
}

function checkForUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox({ type: 'info', message: 'Updates are checked in the installed app only.' });
    }
    return;
  }
  try {
    const { autoUpdater } = require('electron-updater');
    if (manual) {
      autoUpdater
        .checkForUpdatesAndNotify()
        .then((r) => {
          if (!r || !r.isUpdateAvailable) {
            dialog.showMessageBox({ type: 'info', message: `Maintenance ${app.getVersion()} is up to date.` });
          }
        })
        .catch((e) => dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates.', detail: String(e && e.message) }));
    } else {
      // Quietly: offline, or no release yet.
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }
  } catch (e) {
    if (manual) {
      dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates.', detail: String(e && e.message) });
    }
  }
}

function appMenu() {
  const isMac = process.platform === 'darwin';
  return Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Desktop settings…', click: openDesktopSettings },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: 'Quit', accelerator: 'Ctrl+Q', click: () => { quitting = true; app.quit(); } },
      ],
    },
    { role: 'editMenu' },
    { label: 'Go', submenu: goMenu() },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for updates', click: () => checkForUpdates(true) },
        { label: 'Releases on GitHub', click: () => shell.openExternal(RELEASES_URL) },
        { type: 'separator' },
        {
          label: 'About Maintenance',
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: 'About Maintenance',
              message: `Maintenance ${app.getVersion()}`,
              detail: `Desktop client for the Maintenance module (Oracle Visual Builder, Redwood).\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}\nShowing: ${appUrl}`,
            }),
        },
      ],
    },
  ]);
}

/* ---------------------------------------------------------------------------
 * Bridge for the web page (see preload.js)
 * ------------------------------------------------------------------------- */

function validClaudeBody(body) {
  return (
    body &&
    typeof body === 'object' &&
    typeof body.model === 'string' &&
    /^claude-[a-z0-9.-]+$/.test(body.model) &&
    Number.isInteger(body.max_tokens) &&
    body.max_tokens > 0 &&
    body.max_tokens <= 8192 &&
    Array.isArray(body.messages) &&
    body.messages.length > 0
  );
}

function registerIpc() {
  ipcMain.on('mx:info', (event) => {
    event.returnValue = senderAllowed(event)
      ? { isDesktop: true, version: app.getVersion(), platform: process.platform, source: settings.read().serverUrl ? 'hosted' : 'bundled' }
      : null;
  });
  ipcMain.on('mx:key-status', (event) => {
    event.returnValue = senderAllowed(event) ? key.status() : { hasKey: false, keyHint: '', secure: false };
  });
  ipcMain.on('mx:key-save', (event, value) => {
    event.returnValue = senderAllowed(event) ? key.set(value) : key.status();
  });
  ipcMain.on('mx:key-remove', (event) => {
    event.returnValue = senderAllowed(event) ? key.remove() : key.status();
  });

  // Claude Messages API, called from here so the key never reaches the web page.
  ipcMain.handle('mx:claude', async (event, body, keyOverride) => {
    if (!senderAllowed(event)) {
      return { ok: false, status: 403, data: { error: { message: 'This page may not use Auto Pilot.' } } };
    }
    if (!validClaudeBody(body)) {
      return { ok: false, status: 400, data: { error: { message: 'Invalid request.' } } };
    }
    const apiKey = (typeof keyOverride === 'string' && keyOverride.trim()) || key.get();
    if (!apiKey) {
      return { ok: false, status: 401, data: { error: { message: 'No Claude API key is saved in the desktop app.' } } };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await net.fetch(CLAUDE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (e) {
      return { ok: false, status: 0, aborted: !!(e && e.name === 'AbortError'), message: String(e && e.message) };
    } finally {
      clearTimeout(timer);
    }
  });

  ipcMain.on('mx:counts', (event, counts) => {
    if (senderAllowed(event) && counts && typeof counts === 'object') {
      updateBadge({
        pending: Number(counts.pending) || 0,
        drafts: Number(counts.drafts) || 0,
        equipmentDown: Number(counts.equipmentDown) || 0,
        workOrdersActive: Number(counts.workOrdersActive) || 0,
      });
    }
  });

  ipcMain.on('mx:notify', (event, n) => {
    if (!senderAllowed(event) || !n || !Notification.isSupported()) {
      return;
    }
    if (n.onlyWhenUnfocused && win && win.isFocused()) {
      return;
    }
    const notification = new Notification({
      title: String(n.title || 'Maintenance').slice(0, 120),
      body: String(n.body || '').slice(0, 300),
      icon: asset('icon.png'),
    });
    notification.on('click', () => {
      if (n.command && typeof n.command === 'object') {
        sendCommand(n.command);
      } else {
        showWindow();
      }
    });
    notification.show();
  });

  ipcMain.on('mx:open-external', (event, url) => {
    if (senderAllowed(event) && /^https:\/\//i.test(String(url))) {
      shell.openExternal(String(url));
    }
  });
}

/* ---------------------------------------------------------------------------
 * Start
 * ------------------------------------------------------------------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.setAppUserModelId(APP_ID);

  app.whenReady().then(async () => {
    try {
      appUrl = await resolveAppUrl();
    } catch (e) {
      dialog.showErrorBox('Maintenance', `Could not start the app: ${e && e.message}`);
      app.quit();
      return;
    }
    allowedOrigins = new Set([new URL(appUrl).origin]);
    registerIpc();
    Menu.setApplicationMenu(appMenu());
    createWindow();
    createTray();

    const shortcut = settings.read().globalShortcut;
    if (shortcut) {
      try {
        globalShortcut.register(shortcut, () => sendCommand({ command: 'autopilot' }));
      } catch {
        // shortcut taken by another app
      }
    }
    if (settings.read().autoUpdate !== false && !SELFTEST) {
      checkForUpdates(false);
    }
    if (SELFTEST) {
      require('./scripts/selftest').run({ win, appUrl, getCounts: () => lastCounts, key, log: selftestLog });
    }
  });

  app.on('activate', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || !settings.read().closeToTray) {
      app.quit();
    }
  });
}

