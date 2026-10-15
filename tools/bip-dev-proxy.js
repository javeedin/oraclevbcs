'use strict';

/**
 * Fusion SQL: local dev proxy for BI Publisher runReport.
 *
 * The local preview (npm run serve, http://localhost:8888) can't call Fusion directly:
 * the browser blocks it (CORS), and the Fusion password must not live in the page.
 * This proxy runs on your machine only and does what the VB service connection's
 * proxy does in VB Studio: it adds the Fusion credentials and forwards the SOAP call.
 *
 *   npm run proxy                -> http://localhost:8890/bip
 *
 * Configuration (environment variables, or a .env file next to package.json):
 *   FUSION_HOST       your pod, e.g. iacney-test.fa.ocs.oraclecloud.com
 *   FUSION_USER       a Fusion user that can run the Fusion SQL report
 *   FUSION_PASSWORD   its password
 *   PROXY_PORT        optional, default 8890
 *   FUSION_BASE_URL   optional, a full base URL instead of FUSION_HOST (used by the tests)
 *
 * Safety: it listens on 127.0.0.1 only, accepts calls only from localhost pages,
 * and forwards only runReport requests to ExternalReportWSSService.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const SERVICE_PATH = '/xmlpserver/services/ExternalReportWSSService';
const MAX_BODY = 4 * 1024 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function loadEnvFile(file) {
  if (!fs.existsSync(file)) {
    return;
  }
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) {
        return;
      }
      let value = m[2];
      if (/^(['"]).*\1$/.test(value)) {
        value = value.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = value;
      }
    });
}

function config() {
  loadEnvFile(path.join(__dirname, '..', '.env'));
  const host = String(process.env.FUSION_HOST || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const base = String(process.env.FUSION_BASE_URL || '').trim() || (host ? `https://${host}` : '');
  return {
    base: base.replace(/\/+$/, ''),
    user: process.env.FUSION_USER || '',
    password: process.env.FUSION_PASSWORD || '',
    port: Number(process.env.PROXY_PORT) || 8890,
  };
}

function corsHeaders(origin) {
  if (!origin || !LOCAL_ORIGIN.test(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, SOAPAction',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers));
  res.end(body);
}

function soapFault(message) {
  const text = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return (
    '<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><env:Fault>' +
    `<env:Code><env:Value>env:Receiver</env:Value></env:Code><env:Reason><env:Text xml:lang="en">${text}</env:Text></env:Reason>` +
    '</env:Fault></env:Body></env:Envelope>'
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function forward(cfg, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(cfg.base + SERVICE_PATH);
    const client = target.protocol === 'http:' ? http : https;
    const auth = Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64');
    const upstream = client.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=UTF-8',
          'Content-Length': body.length,
          Authorization: `Basic ${auth}`,
          Accept: 'application/soap+xml, text/xml, */*',
        },
        timeout: TIMEOUT_MS,
      },
      (response) => {
        const chunks = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () =>
          resolve({
            status: response.statusCode || 502,
            contentType: response.headers['content-type'] || 'application/soap+xml; charset=UTF-8',
            body: Buffer.concat(chunks),
          }),
        );
        response.on('error', reject);
      },
    );
    upstream.on('timeout', () => upstream.destroy(new Error('Fusion did not answer within 10 minutes')));
    upstream.on('error', reject);
    upstream.end(body);
  });
}

function createServer(cfg) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    const cors = corsHeaders(origin);
    const started = Date.now();
    const url = (req.url || '/').split('?')[0];

    if (origin && !LOCAL_ORIGIN.test(origin)) {
      send(res, 403, {}, 'Only pages served from localhost may use this proxy.');
      return;
    }
    if (req.method === 'OPTIONS') {
      send(res, 204, cors, '');
      return;
    }
    if (req.method === 'GET' && url === '/health') {
      send(
        res,
        200,
        Object.assign({ 'Content-Type': 'application/json' }, cors),
        JSON.stringify({ ok: Boolean(cfg.base && cfg.user && cfg.password), target: cfg.base + SERVICE_PATH, user: cfg.user }),
      );
      return;
    }
    if (req.method !== 'POST' || url !== '/bip') {
      send(res, 404, cors, 'Use POST /bip (or GET /health).');
      return;
    }

    const soapHeaders = Object.assign({ 'Content-Type': 'application/soap+xml; charset=UTF-8' }, cors);
    if (!cfg.base || !cfg.user || !cfg.password) {
      send(res, 500, soapHeaders, soapFault('The dev proxy has no Fusion host or credentials. Copy .env.example to .env and fill in FUSION_HOST, FUSION_USER and FUSION_PASSWORD, then restart npm run proxy.'));
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      send(res, 413, soapHeaders, soapFault(e.message));
      return;
    }
    const text = body.toString('utf8');
    if (!/<[\w-]+:runReport[\s>]/.test(text) && !/<runReport[\s>]/.test(text)) {
      send(res, 400, soapHeaders, soapFault('The dev proxy only forwards runReport requests.'));
      return;
    }

    try {
      const answer = await forward(cfg, body);
      res.writeHead(answer.status, Object.assign({ 'Content-Type': answer.contentType }, cors));
      res.end(answer.body);
      console.log(`${new Date().toISOString()}  runReport  HTTP ${answer.status}  ${Date.now() - started} ms  ${answer.body.length} bytes`);
    } catch (e) {
      send(res, 502, soapHeaders, soapFault(`The dev proxy could not reach ${cfg.base}: ${e.message}`));
      console.log(`${new Date().toISOString()}  runReport  failed  ${e.message}`);
    }
  });
}

if (require.main === module) {
  const cfg = config();
  const server = createServer(cfg);
  server.listen(cfg.port, '127.0.0.1', () => {
    console.log(`Fusion SQL dev proxy on http://localhost:${cfg.port}/bip`);
    console.log(`Forwarding runReport to ${cfg.base ? cfg.base + SERVICE_PATH : '(FUSION_HOST not set - see .env.example)'}`);
    console.log(cfg.user ? `As Fusion user ${cfg.user}` : 'FUSION_USER not set - see .env.example');
  });
}

module.exports = { createServer, config };
