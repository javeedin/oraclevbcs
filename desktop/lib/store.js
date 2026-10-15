'use strict';

/**
 * Desktop settings and the Claude API key.
 * The key is encrypted with Electron safeStorage (Windows DPAPI, macOS Keychain, Linux secret
 * service). If the operating system offers no secure storage, the key is kept in memory only.
 */
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const DEFAULT_SETTINGS = {
  serverUrl: '', // empty: the app bundled in the desktop client; or the URL of the app hosted in Visual Builder
  closeToTray: false,
  autoUpdate: true,
  globalShortcut: 'CommandOrControl+Shift+Space',
  bounds: null,
};

let memoryKey = '';

function file(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(name, fallback) {
  try {
    return Object.assign({}, fallback, JSON.parse(fs.readFileSync(file(name), 'utf8')));
  } catch {
    return Object.assign({}, fallback);
  }
}

function writeJson(name, value) {
  fs.mkdirSync(path.dirname(file(name)), { recursive: true });
  fs.writeFileSync(file(name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const settings = {
  path: () => file('settings.json'),
  read: () => readJson('settings.json', DEFAULT_SETTINGS),
  write: (patch) => {
    const next = Object.assign(settings.read(), patch);
    writeJson('settings.json', next);
    return next;
  },
  ensureFile: () => {
    if (!fs.existsSync(file('settings.json'))) {
      writeJson('settings.json', DEFAULT_SETTINGS);
    }
    return file('settings.json');
  },
};

function secure() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

const key = {
  secure,
  get() {
    if (memoryKey) {
      return memoryKey;
    }
    const stored = readJson('secrets.json', {}).claudeKey;
    if (!stored || !secure()) {
      return '';
    }
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    } catch {
      return '';
    }
  },
  set(value) {
    const v = String(value || '').trim();
    if (!v) {
      return key.remove();
    }
    if (secure()) {
      writeJson('secrets.json', { claudeKey: safeStorage.encryptString(v).toString('base64') });
      memoryKey = '';
    } else {
      memoryKey = v; // no secure storage on this system: keep it until the app closes
    }
    return key.status();
  },
  remove() {
    memoryKey = '';
    try {
      fs.rmSync(file('secrets.json'), { force: true });
    } catch {
      // ignore
    }
    return key.status();
  },
  status() {
    const k = key.get();
    return {
      hasKey: !!k,
      keyHint: k ? `${k.slice(0, 7)}…${k.slice(-4)}` : '',
      secure: secure(),
      store: process.platform === 'win32' ? 'Windows secure storage (DPAPI)' : process.platform === 'darwin' ? 'the macOS Keychain' : 'the system secret service',
    };
  },
};

module.exports = { settings, key, DEFAULT_SETTINGS };
