'use strict';

/**
 * Puts the built Visual Builder app into desktop/app, exactly as `grunt vb-serve` serves it.
 * Run from the repository folder after `npm run build` (npm run build:desktop does both):
 *
 *   1. starts `grunt vb-serve:webApps/maint --port=18888` (the same server as npm run serve);
 *   2. downloads every file of the processed web app (build/processed/webApps/maint) from that server
 *      into desktop/app, so whatever vb-serve fills in on the fly (index.html scripts, %{env.*}%
 *      values) is filled in; a file the server doesn't serve is copied as it is;
 *   3. also saves what index.html links to and the services catalog the VB runtime asks for;
 *   4. stops the server and checks that nothing still waits for a VB server.
 *
 * The desktop client then serves desktop/app on http://localhost:18888/.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const dest = path.resolve(__dirname, '..', 'app');
const PORT = 18888;
const BASE = `http://localhost:${PORT}/`;

function fail(message) {
  console.error(`\nbuild-app: ${message}\n`);
  process.exit(1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const response = await fetch(url, { redirect: 'follow' });
  return { ok: response.ok, status: response.status, type: response.headers.get('content-type') || '', body: Buffer.from(await response.arrayBuffer()) };
}

function findProcessed() {
  const preferred = path.join(repo, 'build', 'processed', 'webApps', 'maint');
  if (fs.existsSync(path.join(preferred, 'index.html'))) {
    return preferred;
  }
  const hits = [];
  const walk = (dir, depth) => {
    if (depth > 6 || !fs.existsSync(dir)) {
      return;
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'node_modules') {
        continue;
      }
      const full = path.join(dir, e.name);
      if (e.name === 'maint' && path.basename(dir) === 'webApps' && fs.existsSync(path.join(full, 'index.html'))) {
        hits.push(full);
      } else {
        walk(full, depth + 1);
      }
    }
  };
  walk(path.join(repo, 'build'), 0);
  return hits.sort((a, b) => a.length - b.length)[0] || '';
}

/** Same-origin files index.html links to (scripts, styles, icons, manifests). */
function linkedFiles(html) {
  const out = new Set();
  const re = /\b(?:src|href)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const ref = m[1].trim();
    if (!ref || /^(data|mailto|javascript):/i.test(ref)) {
      continue;
    }
    const url = new URL(ref, BASE);
    if (url.origin === new URL(BASE).origin && url.pathname !== '/') {
      out.add(decodeURIComponent(url.pathname));
    }
  }
  return [...out];
}

async function main() {
  const processed = findProcessed();
  if (!processed) {
    fail('No build found. Run "npm run build" first (npm run build:desktop does it for you).');
  }

  const gruntCli = require.resolve('grunt-cli/bin/grunt', { paths: [repo] });
  console.log(`build-app: starting grunt vb-serve on port ${PORT}…`);
  const server = spawn(process.execPath, [gruntCli, 'vb-serve:webApps/maint', `--port=${PORT}`], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (c) => {
    log += c;
  });
  server.stderr.on('data', (c) => {
    log += c;
  });
  const stop = () => {
    try {
      server.kill();
    } catch {
      // already stopped
    }
  };
  process.on('exit', stop);

  try {
    let index = null;
    for (let i = 0; i < 120 && !index; i++) {
      if (server.exitCode !== null) {
        fail(`grunt vb-serve stopped:\n${log.slice(-3000)}`);
      }
      try {
        const r = await get(BASE);
        if (r.ok) {
          index = r.body.toString('utf8');
        }
      } catch {
        // not listening yet
      }
      if (!index) {
        await wait(1000);
      }
    }
    if (!index) {
      fail(`grunt vb-serve did not answer on ${BASE} within 2 minutes:\n${log.slice(-3000)}`);
    }

    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });

    // Every processed file, as vb-serve serves it (or as it is, when the server doesn't serve it).
    const files = [];
    const list = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? list(path.join(dir, e.name)) : files.push(path.join(dir, e.name))));
    list(processed);
    let served = 0;
    let copied = 0;
    const queue = files.slice();
    const worker = async () => {
      while (queue.length) {
        const file = queue.shift();
        const rel = path.relative(processed, file).split(path.sep);
        const target = path.join(dest, ...rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        let r = null;
        try {
          r = await get(new URL(rel.map(encodeURIComponent).join('/'), BASE).href);
        } catch {
          r = null;
        }
        if (r && r.ok) {
          fs.writeFileSync(target, r.body);
          served += 1;
        } else {
          fs.copyFileSync(file, target);
          copied += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: 12 }, worker));
    fs.writeFileSync(path.join(dest, 'index.html'), index, 'utf8');
    console.log(`build-app: ${served} files from vb-serve, ${copied} copied as they are.`);

    const added = [];
    for (const file of linkedFiles(index)) {
      const target = path.normalize(path.join(dest, file));
      if (!target.startsWith(dest + path.sep) || fs.existsSync(target)) {
        continue;
      }
      const r = await get(new URL(file, BASE).href);
      if (r.ok) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, r.body);
        added.push(file);
      } else {
        console.warn(`build-app: ${file} is linked from index.html but answered HTTP ${r.status}`);
      }
    }

    // The services catalog the VB runtime asks for (at the root and under version_* folders).
    const versions = new Set(fs.readdirSync(dest).filter((n) => /^version_\d+$/.test(n)));
    (index.match(/version_\d+/g) || []).forEach((v) => versions.add(v));
    const roots = [''].concat([...versions].map((v) => `${v}/`));
    for (const root of roots) {
      const rel = `${root}services/catalog.json`;
      const target = path.join(dest, ...rel.split('/'));
      if (fs.existsSync(target)) {
        continue;
      }
      try {
        const r = await get(new URL(rel, BASE).href);
        if (r.ok) {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, r.body);
          added.push(`/${rel}`);
        }
      } catch {
        // not served: the runtime logs it and carries on
      }
    }

    const left = ['<!-- visualBuilderScripts -->', 'vb:inject'].filter((marker) => index.includes(marker));
    if (left.length) {
      fail(`index.html from vb-serve still contains ${left.join(' and ')}.`);
    }
    const placeholders = [];
    const scan = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          scan(full);
        } else if (/\.(html|json|js)$/.test(e.name) && fs.readFileSync(full, 'utf8').includes('%{env.')) {
          placeholders.push(path.relative(dest, full));
        }
      });
    scan(dest);
    if (placeholders.length) {
      console.warn(`build-app: %{env.*}% placeholders left in ${placeholders.join(', ')}`);
    }

    let total = 0;
    const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? count(path.join(dir, e.name)) : (total += 1)));
    count(dest);
    fs.writeFileSync(
      path.join(dest, 'desktop-build.json'),
      `${JSON.stringify({ builtAt: new Date().toISOString(), from: path.relative(repo, processed), servedBy: 'grunt vb-serve', served, copied, added, placeholders, files: total }, null, 2)}\n`,
    );
    console.log(`build-app: desktop/app is ready: ${total} files (${added.length} more from vb-serve: ${added.join(', ') || 'none'}).`);
    if (process.env.GITHUB_ACTIONS === 'true') {
      const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      const summary = [
        `${total} files: ${served} from vb-serve, ${copied} copied as they are`,
        `added: ${added.join(', ') || 'none'}`,
        `placeholders left: ${placeholders.join(', ') || 'none'}`,
        `top level: ${fs.readdirSync(dest).join(', ')}`,
        `version tokens in index.html: ${[...new Set(index.match(/version_\d+/g) || [])].join(', ') || 'none'}`,
      ];
      console.log(`::notice title=Desktop app files::${esc(summary.join('\n'))}`);
    }
  } finally {
    stop();
  }
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
