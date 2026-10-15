'use strict';

/**
 * What the web app sees of the desktop client: window.mxDesktop (see app-flow.js, "desktop client").
 * Sandboxed: only the calls below cross over, and the Claude API key never does.
 */
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('mx:info') || null;

if (info && info.isDesktop) {
  contextBridge.exposeInMainWorld('mxDesktop', {
    isDesktop: true,
    version: info.version,
    platform: info.platform,

    /** { isDesktop, version, platform, source: 'bundled' | 'hosted' } */
    info: () => ipcRenderer.sendSync('mx:info'),

    /** { hasKey, keyHint, secure, store } - never the key itself */
    keyStatus: () => ipcRenderer.sendSync('mx:key-status'),
    saveKey: (value) => ipcRenderer.sendSync('mx:key-save', String(value || '')),
    removeKey: () => ipcRenderer.sendSync('mx:key-remove'),

    /**
     * Claude Messages API call made by the desktop app with the saved key
     * (or with keyOverride, to test a key before saving it).
     * Resolves { ok, status, data } or { ok: false, status: 0, aborted, message } when Claude can't be reached.
     */
    claude: (body, keyOverride) => ipcRenderer.invoke('mx:claude', body, keyOverride || ''),

    /** Tray tooltip, taskbar badge: { pending, drafts, equipmentDown, workOrdersActive } */
    setCounts: (counts) => ipcRenderer.send('mx:counts', counts),

    /** Desktop notification: { title, body, command, onlyWhenUnfocused } */
    notify: (notification) => ipcRenderer.send('mx:notify', notification),

    openExternal: (url) => ipcRenderer.send('mx:open-external', String(url || '')),

    /** Commands from the tray, the menu and the global shortcut: { command: 'navigate' | 'autopilot' | 'settings', flow } */
    onCommand: (callback) => {
      if (typeof callback !== 'function') {
        return;
      }
      ipcRenderer.removeAllListeners('mx:command');
      ipcRenderer.on('mx:command', (_event, command) => callback(command));
    },
  });
}
