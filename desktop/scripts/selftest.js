'use strict';

/**
 * Smoke test of the desktop client, run by main.js when MX_SELFTEST=1 (never in the installed app).
 *
 *   MX_SELFTEST=1             checks the bridge (window.mxDesktop), the key store, the Claude call
 *                             (against a mock on MX_CLAUDE_URL), counts and commands
 *   MX_SELFTEST_APP=1         also checks the real Visual Builder app: it renders, the header
 *                             count is right, commands navigate and open Auto Pilot, no download button
 *   MX_SELFTEST_OUT=dir       where to write selftest.json and selftest.png
 *
 * Exits with 0 when every check passed, 1 otherwise.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { app, ipcMain } = require('electron');

const TEST_KEY = 'sk-ant-selftest-0000000000-abcd';

function mockClaude(url) {
  const u = new URL(url);
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      seen.push({ key: req.headers['x-api-key'], version: req.headers['anthropic-version'], browser: req.headers['anthropic-dangerous-direct-browser-access'] });
      res.setHeader('content-type', 'application/json');
      if (req.headers['x-api-key'] !== TEST_KEY) {
        res.statusCode = 401;
        res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
        return;
      }
      const body = JSON.parse(raw || '{}');
      res.end(
        JSON.stringify({
          id: 'msg_selftest',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [{ type: 'text', text: 'OK' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      );
    });
  });
  return new Promise((resolve) => server.listen(Number(u.port), '127.0.0.1', () => resolve({ server, seen })));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(win, expression, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      last = await win.webContents.executeJavaScript(expression, true);
      if (last) {
        return last;
      }
    } catch (e) {
      last = String(e && e.message);
    }
    await wait(250);
  }
  return null;
}

async function run({ win, appUrl, getCounts, key, log }) {
  const out = process.env.MX_SELFTEST_OUT || path.join(app.getPath('temp'), 'maintenance-selftest');
  fs.mkdirSync(out, { recursive: true });
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  };
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const realApp = process.env.MX_SELFTEST_APP === '1';
  let mock = null;

  try {
    const claudeUrl = process.env.MX_CLAUDE_URL;
    if (claudeUrl) {
      mock = await mockClaude(claudeUrl);
    }

    await new Promise((resolve) => {
      if (!win.webContents.isLoading()) {
        resolve();
      } else {
        win.webContents.once('did-finish-load', resolve);
      }
    });
    check('page loaded', true, appUrl);

    const bridge = await js('typeof window.mxDesktop === "object" && window.mxDesktop.isDesktop === true');
    check('window.mxDesktop is exposed', bridge === true);
    check('Node is not exposed to the page', (await js('typeof require === "undefined" && typeof process === "undefined"')) === true);

    const info = await js('window.mxDesktop.info()');
    check('info()', info && info.isDesktop === true && typeof info.version === 'string', info);

    key.remove();
    let status = await js(`window.mxDesktop.saveKey(${JSON.stringify(TEST_KEY)})`);
    check('saveKey() returns a hint, never the key', status && status.hasKey === true && !JSON.stringify(status).includes(TEST_KEY), status);
    check('key is stored for the main process', key.get() === TEST_KEY);

    if (mock) {
      const ok = await js('window.mxDesktop.claude({ model: "claude-sonnet-5-5", max_tokens: 16, messages: [{ role: "user", content: "Reply OK" }] })');
      check('claude() with the saved key', ok && ok.ok === true && ok.status === 200 && ok.data.content[0].text === 'OK', ok && ok.status);
      const last = mock.seen[mock.seen.length - 1] || {};
      check('claude() sends x-api-key and anthropic-version from the main process', last.key === TEST_KEY && last.version === '2023-06-01' && !last.browser, last.version);
      const bad = await js('window.mxDesktop.claude({ model: "claude-sonnet-5-5", max_tokens: 16, messages: [{ role: "user", content: "x" }] }, "sk-ant-wrong")');
      check('claude() with a key override (test connection)', bad && bad.ok === false && bad.status === 401, bad && bad.status);
      const invalid = await js('window.mxDesktop.claude({ model: "gpt", max_tokens: 99999, messages: [] })');
      check('claude() rejects an invalid body', invalid && invalid.status === 400, invalid && invalid.status);
    }

    status = await js('window.mxDesktop.removeKey()');
    check('removeKey()', status && status.hasKey === false && key.get() === '', status);

    if (!realApp) {
      await js('window.mxDesktop.setCounts({ pending: 4, drafts: 2, equipmentDown: 1, workOrdersActive: 3 })');
      await wait(300);
      check('setCounts() updates the tray and badge', getCounts().pending === 4 && getCounts().drafts === 2, getCounts());

      await js('window.__mxCommands = []; window.mxDesktop.onCommand((c) => window.__mxCommands.push(c));');
      win.webContents.send('mx:command', { command: 'navigate', flow: 'inbox' });
      const got = await waitFor(win, 'window.__mxCommands.length > 0 && window.__mxCommands[0]', 3000);
      check('commands reach the page', got && got.command === 'navigate' && got.flow === 'inbox', got);
    } else {
      const rendered = await waitFor(win, '!!document.querySelector("oj-sp-in-app-navigation") && !!document.querySelector(".mx-appbar")', 90000);
      check('Visual Builder app renders (shell, Redwood navigation)', !!rendered);

      const header = await waitFor(
        win,
        '(() => { const b = [...document.querySelectorAll(".mx-appbar oj-button")].map((e) => e.textContent.trim()); const a = b.find((t) => /^Approvals \\(\\d+\\)$/.test(t)); return a && !/\\(0\\)$/.test(a) ? b : null; })()',
        30000,
      );
      check('header shows the approvals waiting (not 0)', !!header, header || (await js('[...document.querySelectorAll(".mx-appbar oj-button")].map((e) => e.textContent.trim())')));
      check('no "Download desktop app" button inside the desktop app', (await js('!document.body.textContent.includes("Download desktop app")')) === true);

      const shown = header ? Number((header.find((t) => /^Approvals/.test(t)).match(/\((\d+)\)/) || [])[1]) : -1;
      check('app sends the same count to the tray and badge', getCounts().pending === shown, { header: shown, tray: getCounts() });

      win.webContents.send('mx:command', { command: 'navigate', flow: 'inbox' });
      const nav = await waitFor(win, 'location.href.includes("inbox") && location.href', 20000);
      check('tray/menu command navigates (Approvals)', !!nav, nav || (await js('location.href')));

      win.webContents.send('mx:command', { command: 'autopilot' });
      const opened = await waitFor(win, '(() => { const d = document.getElementById("autopilotDrawer"); return !!d && d.opened === true; })()', 10000);
      check('shortcut command opens Auto Pilot', !!opened);

      if (mock) {
        // A real question through the VB app, the bridge and the main process (mock Claude answers "OK").
        key.set(TEST_KEY);
        const calls = mock.seen.length;
        win.webContents.send('mx:command', { command: 'autopilot', prompt: 'What needs my attention today?' });
        const answer = await waitFor(
          win,
          '(() => { const a = [...document.querySelectorAll("#mxApLog .mx-ap-answer")].map((e) => e.textContent.replace(/\\s+/g, " ").trim()); return a.length ? a[a.length - 1] : null; })()',
          20000,
        );
        const sent = mock.seen.slice(calls);
        check('Auto Pilot answers through the desktop app', !!answer && /OK/.test(answer) && sent.length > 0 && sent.every((c) => c.key === TEST_KEY && !c.browser), { answer, calls: sent.length });
        key.remove();
      }
      await wait(800);
    }

    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(out, 'selftest.png'), image.toPNG());
  } catch (e) {
    check('selftest ran without errors', false, e && e.stack ? e.stack : String(e));
  }

  const passed = checks.every((c) => c.ok);
  const problems = (log || []).slice(0, 200);
  if (problems.length) {
    console.log(`\nRequests that failed and page errors (${problems.length}):\n  ${problems.join('\n  ')}`);
  }
  fs.writeFileSync(path.join(out, 'selftest.json'), `${JSON.stringify({ passed, appUrl, checks, problems }, null, 2)}\n`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    // Annotations: visible on the workflow run and through the commit's check runs.
    const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const lines = checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` - ${(typeof c.detail === 'string' ? c.detail : JSON.stringify(c.detail)).slice(0, 300)}` : ''}`);
    console.log(`::${passed ? 'notice' : 'error'} title=Desktop selftest ${passed ? 'passed' : 'FAILED'} (${checks.filter((c) => c.ok).length}/${checks.length})::${esc(lines.join('\n'))}`);
    if (problems.length) {
      console.log(`::warning title=Failed requests and page errors (${problems.length})::${esc(problems.slice(0, 40).join('\n'))}`);
    }
  }
  console.log(`\nselftest: ${checks.filter((c) => c.ok).length}/${checks.length} passed, results in ${out}`);
  if (mock) {
    mock.server.close();
  }
  ipcMain.removeAllListeners();
  app.exit(passed ? 0 : 1);
}

module.exports = { run };
