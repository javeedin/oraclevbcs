'use strict';

/**
 * Tiny static web server for the built Visual Builder app (the same files `grunt vb-serve` serves).
 * It listens on 127.0.0.1 only. Files can live inside the app's asar archive.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// What the VB runtime may ask for when the app does not require sign-in.
const ANONYMOUS_USER = {
  userId: 'anonymous',
  username: 'demo',
  fullName: 'Demo user',
  email: '',
  isAuthenticated: false,
  isAdmin: false,
  roles: [],
  permissions: [],
};

function send(res, status, type, body) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function createServer(root, onMiss) {
  const base = path.resolve(root);
  const miss = (status, pathname) => {
    if (typeof onMiss === 'function') {
      onMiss(status, pathname);
    }
  };
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch {
      send(res, 400, 'text/plain', 'Bad request');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'text/plain', 'Method not allowed');
      return;
    }
    if (pathname === '/_currentuser' || pathname.endsWith('/_currentuser')) {
      send(res, 200, MIME['.json'], JSON.stringify(ANONYMOUS_USER));
      return;
    }
    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }
    const file = path.normalize(path.join(base, pathname));
    if (file !== base && !file.startsWith(base + path.sep)) {
      send(res, 403, 'text/plain', 'Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (!err) {
        send(res, 200, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', req.method === 'HEAD' ? '' : data);
        return;
      }
      // VB asks for resources under a version_<n>/ prefix; serve them from the folder itself when needed.
      const unversioned = pathname.replace(/^\/version_\d+\//, '/');
      if (unversioned !== pathname) {
        const alt = path.normalize(path.join(base, unversioned));
        if (alt.startsWith(base + path.sep) && fs.existsSync(alt) && fs.statSync(alt).isFile()) {
          send(res, 200, MIME[path.extname(alt).toLowerCase()] || 'application/octet-stream', req.method === 'HEAD' ? '' : fs.readFileSync(alt));
          return;
        }
      }
      // Single-page app: unknown routes without a file extension get index.html.
      if (!path.extname(pathname)) {
        fs.readFile(path.join(base, 'index.html'), (err2, html) => {
          if (err2) {
            miss(404, pathname);
            send(res, 404, 'text/plain', 'The app files are missing. Rebuild the desktop app (npm run build:desktop).');
          } else {
            send(res, 200, MIME['.html'], html);
          }
        });
        return;
      }
      miss(404, pathname);
      send(res, 404, 'text/plain', 'Not found');
    });
  });
}

/**
 * Starts the server on the preferred port (the port the app was built for), or any free port.
 * onMiss(status, path) is called for files that are not there.
 * @returns {Promise<{server: http.Server, port: number}>}
 */
function start(root, preferredPort, onMiss) {
  return new Promise((resolve, reject) => {
    const server = createServer(root, onMiss);
    const listen = (port, fallback) => {
      server.once('error', (err) => {
        if (fallback && err && err.code === 'EADDRINUSE') {
          listen(0, false);
        } else {
          reject(err);
        }
      });
      server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    };
    listen(preferredPort, true);
  });
}

module.exports = { start, createServer, MIME };
