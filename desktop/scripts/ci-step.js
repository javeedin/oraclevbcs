'use strict';

/**
 * Runs one CI step and, when it fails, reports the end of its output as a GitHub annotation
 * (shown on the workflow run and on the commit's checks).
 *
 *   node desktop/scripts/ci-step.js "Build the web app" -- npm run build:desktop
 */
const { spawn } = require('child_process');

const sep = process.argv.indexOf('--');
const title = sep > 2 ? process.argv.slice(2, sep).join(' ') : 'CI step';
const command = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2);
if (!command.length) {
  console.error('usage: node ci-step.js "<title>" -- <command> [args...]');
  process.exit(2);
}

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
let tail = '';
const keep = (chunk) => {
  tail = (tail + chunk).slice(-6000);
};

const child = spawn(command.join(' '), { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (c) => {
  process.stdout.write(c);
  keep(c);
});
child.stderr.on('data', (c) => {
  process.stderr.write(c);
  keep(c);
});
child.on('close', (code, signal) => {
  if (code !== 0) {
    const lines = tail.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).filter((l) => l.trim()).slice(-60).join('\n');
    console.log(`::error title=${esc(title)} failed (${signal || `exit ${code}`})::${esc(lines)}`);
  }
  process.exit(code === null ? 1 : code);
});
