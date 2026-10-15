'use strict';

/**
 * Fusion SQL tests (npm test). No browser and no Fusion needed:
 *  - the VB modules (AMD) are loaded with a tiny define() and browser-like globals;
 *  - BI Publisher is simulated: answers are built the way Fusion builds them
 *    (SOAP 1.2 envelope, base64 reportBytes, DATA_DS/G_1/RESULT with an escaped ROWSET);
 *  - chains run against a mock VB context ($page / $application);
 *  - the dev proxy runs for real against a mock Fusion HTTP server.
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'webApps', 'fusionsql');
const PAGE = path.join(APP, 'pages');
const CHAINS = path.join(PAGE, 'fusion-sql-page-chains');
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';

/* ======================================================================
 * Test runner
 * ==================================================================== */

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

/* ======================================================================
 * Browser-like globals
 * ==================================================================== */

const storage = new Map();
const localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

let fetchImpl = async () => {
  throw new Error('fetch not mocked');
};

const elements = new Map();
const created = [];
const documentMock = {
  getElementById: (id) => elements.get(id) || null,
  createElement: (tag) => {
    const el = {
      tag,
      style: {},
      attrs: {},
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      click() {
        this.clicked = true;
      },
      remove() {
        this.removed = true;
      },
      select() {},
    };
    created.push(el);
    return el;
  },
  body: { appendChild: () => {} },
  execCommand: () => true,
};

const clipboard = { text: null };
globalThis.window = {
  localStorage,
  DOMParser,
  XMLSerializer,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  fetch: (...args) => fetchImpl(...args),
  location: { hostname: 'localhost' },
};
globalThis.document = documentMock;
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async (t) => (clipboard.text = t) } },
  configurable: true,
  writable: true,
});
const downloads = [];
const realCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = (blob) => {
  downloads.push(blob);
  return 'blob:mock';
};
URL.revokeObjectURL = () => {};

function makeTextarea(value) {
  return {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    focus() {},
    setSelectionRange(a, b) {
      this.selectionStart = a;
      this.selectionEnd = b;
    },
  };
}

const editor = makeTextarea('');
elements.set('sqlEditor', { querySelector: (sel) => (sel === 'textarea' ? editor : null) });
const dialog = {
  opened: false,
  open() {
    this.opened = true;
  },
  close() {
    this.opened = false;
  },
};
elements.set('settingsDialog', dialog);
const askField = { rawValue: '' };
elements.set('askField', askField);
const keyField = { rawValue: '' };
elements.set('claudeKeyField', keyField);
const tableSearchField = { rawValue: '' };
elements.set('tableSearchField', tableSearchField);

/* ======================================================================
 * AMD loader
 * ==================================================================== */

function loadAmd(file, deps) {
  const code = fs.readFileSync(file, 'utf8');
  let result;
  const define = (names, factory) => {
    result = factory(
      ...names.map((n) => {
        if (!(n in deps)) {
          throw new Error(`${path.basename(file)} needs ${n}`);
        }
        return deps[n];
      }),
    );
  };
  new Function('define', code)(define);
  return result;
}

class MockADP {
  constructor(data, options) {
    this.data = data;
    this.options = options;
  }
}

let restImpl = {
  get: () => {
    throw new Error('Service "fusionBip" not found');
  },
};
const RestProxy = { get: (...a) => restImpl.get(...a) };

const AppModule = loadAmd(path.join(APP, 'app-flow.js'), { 'vb/helpers/rest': RestProxy });
const PageModule = loadAmd(path.join(PAGE, 'fusion-sql-page.js'), { 'ojs/ojarraydataprovider': MockADP });
const app = new AppModule();
const page = new PageModule();
const E = app.engine();

/* ======================================================================
 * Simulated BI Publisher
 * ==================================================================== */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rowsetXml(rows, cols) {
  if (!rows.length) {
    return '';
  }
  const body = rows
    .map(
      (r) =>
        ` <ROW>\n${cols
          .map((c) => (r[c] === null || r[c] === undefined ? `  <${c} xsi:nil = "true"/>` : `  <${c}>${esc(r[c])}</${c}>`))
          .join('\n')}\n </ROW>`,
    )
    .join('\n');
  return `<?xml version="1.0"?>\n<ROWSET xmlns:xsi = "${XSI}">\n${body}\n</ROWSET>\n`;
}

function reportXml(sql, maxRows, rowset) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<!--Generated by Oracle Analytics Publisher-->\n' +
    `<DATA_DS><P_SQL>${esc(sql)}</P_SQL><P_MAX_ROWS>${esc(maxRows || '')}</P_MAX_ROWS>\n<G_1>\n<RESULT>${esc(rowset)}</RESULT>\n</G_1>\n</DATA_DS>`
  );
}

function soapOk(xml) {
  const b64 = Buffer.from(xml, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?><env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Header/><env:Body>' +
    '<ns2:runReportResponse xmlns:ns2="http://xmlns.oracle.com/oxp/service/PublicReportService"><ns2:runReportReturn>' +
    `<ns2:metaDataList xsi:nil="true" xmlns:xsi="${XSI}"/><ns2:reportBytes>${b64}</ns2:reportBytes>` +
    '<ns2:reportContentType>text/xml</ns2:reportContentType><ns2:reportFileID xsi:nil="true" xmlns:xsi="' +
    XSI +
    '"/></ns2:runReportReturn></ns2:runReportResponse></env:Body></env:Envelope>'
  );
}

function soapFault12(text) {
  return (
    '<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><env:Fault><env:Code><env:Value>env:Receiver</env:Value></env:Code>' +
    `<env:Reason><env:Text xml:lang="en-US">${esc(text)}</env:Text></env:Reason></env:Fault></env:Body></env:Envelope>`
  );
}

function soapFault11(text) {
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault>' +
    `<faultcode>soapenv:Server</faultcode><faultstring>${esc(text)}</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`
  );
}

/** Reads p_sql / p_max_rows from a runReport envelope. */
function readEnvelope(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const params = {};
  const items = doc.getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'item');
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const nameEl = it.getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'name')[0];
    if (nameEl && nameEl.parentNode === it) {
      const valueEl = it
        .getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'values')[0]
        .getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'item')[0];
      params[nameEl.textContent] = valueEl ? valueEl.textContent : '';
    }
  }
  const pathEl = doc.getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'reportAbsolutePath')[0];
  const cache = doc.getElementsByTagNameNS('http://xmlns.oracle.com/oxp/service/PublicReportService', 'byPassCache')[0];
  return { params, reportPath: pathEl ? pathEl.textContent : '', byPassCache: cache ? cache.textContent : '' };
}

const PERIODS = [];
for (let i = 0; i < 30; i += 1) {
  PERIODS.push({
    LEDGER_NAME: i % 2 ? 'BUIMERC LEDGER' : 'دفتر الأستاذ',
    PERIOD_NAME: `P-${String(i + 1).padStart(2, '0')}`,
    CLOSING_STATUS: i < 3 ? 'O' : 'C',
    AMOUNT: i === 4 ? null : String((i * 1250.5).toFixed(2)),
    COUNT_x0028__x002A__x0029_: String(i * 3),
  });
}

/** Very small "Fusion": answers a few known queries the way BI Publisher would. */
function fusion(envelopeText) {
  const env = readEnvelope(envelopeText);
  const sql = env.params.p_sql || '';
  const max = Number(env.params.p_max_rows) || 0;
  const limit = (rows) => (max > 0 ? rows.slice(0, max) : rows);
  const respond = (rows, cols) => ({ status: 200, body: soapOk(reportXml(sql, env.params.p_max_rows, rowsetXml(limit(rows), cols))) });

  if (env.reportPath !== '/Custom/FusionSQL/FUSION_SQL_RPT.xdo') {
    return { status: 500, body: soapFault12(`oracle.xdo.webservice.exception.OperationFailedException: PublicReportService::executeReport failure due to: Report ${env.reportPath} does not exist`) };
  }
  if (/bad_column/i.test(sql)) {
    return {
      status: 500,
      body: soapFault12(
        'oracle.xdo.webservice.exception.OperationFailedException: PublicReportService::executeReport failure due to: oracle.xdo.XDOException: java.sql.SQLSyntaxErrorException: ORA-00904: "BAD_COLUMN": invalid identifier\nORA-06512: at line 9\nORA-06512: at line 1',
      ),
    };
  }
  if (/'OK' AS status/i.test(sql)) {
    return respond([{ STATUS: 'OK', SERVER_TIME: '2026-10-15 18:30:00' }], ['STATUS', 'SERVER_TIME']);
  }
  if (/from\s+all_objects/i.test(sql)) {
    const rows = [
      { OBJECT_NAME: 'PO_HEADERS_ALL', OBJECT_TYPE: 'TABLE', OWNER: 'FUSION' },
      { OBJECT_NAME: 'PO_HEADERS_INTERFACE', OBJECT_TYPE: 'TABLE', OWNER: 'FUSION' },
      { OBJECT_NAME: 'PO_HEADERS_V', OBJECT_TYPE: 'VIEW', OWNER: 'FUSION' },
    ];
    return respond(rows, ['OBJECT_NAME', 'OBJECT_TYPE', 'OWNER']);
  }
  if (/from\s+all_tab_columns/i.test(sql)) {
    const rows = [
      { COLUMN_NAME: 'PO_HEADER_ID', DATA_TYPE: 'NUMBER', DATA_LENGTH: '22', DATA_PRECISION: '18', DATA_SCALE: '0', NULLABLE: 'N' },
      { COLUMN_NAME: 'SEGMENT1', DATA_TYPE: 'VARCHAR2', DATA_LENGTH: '30', DATA_PRECISION: null, DATA_SCALE: null, NULLABLE: 'N' },
      { COLUMN_NAME: 'VENDOR_ID', DATA_TYPE: 'NUMBER', DATA_LENGTH: '22', DATA_PRECISION: null, DATA_SCALE: null, NULLABLE: 'Y' },
      { COLUMN_NAME: 'CREATION_DATE', DATA_TYPE: 'TIMESTAMP(6)', DATA_LENGTH: '11', DATA_PRECISION: null, DATA_SCALE: '6', NULLABLE: 'Y' },
    ];
    return respond(rows, ['COLUMN_NAME', 'DATA_TYPE', 'DATA_LENGTH', 'DATA_PRECISION', 'DATA_SCALE', 'NULLABLE']);
  }
  if (/no_rows/i.test(sql)) {
    return { status: 200, body: soapOk(reportXml(sql, env.params.p_max_rows, '')) };
  }
  if (/gl_period_statuses|periods/i.test(sql)) {
    return respond(PERIODS, ['LEDGER_NAME', 'PERIOD_NAME', 'CLOSING_STATUS', 'AMOUNT', 'COUNT_x0028__x002A__x0029_']);
  }
  return respond([{ GREETING: 'hello' }], ['GREETING']);
}

function responseLike(status, body, contentType) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType || 'application/soap+xml' },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

const sent = [];
function useMockFusion() {
  fetchImpl = async (url, opts) => {
    sent.push({ url, opts });
    if (String(url).startsWith('https://api.anthropic.com')) {
      return claudeRespond(url, opts);
    }
    const answer = fusion(opts.body);
    return responseLike(answer.status, answer.body);
  };
}

const claudeCalls = [];
let claudeAnswer = '```sql\nSELECT segment1 AS po_number\n  FROM po_headers_all\n ORDER BY creation_date DESC;\n```\nAssumes all business units.';
function claudeRespond(url, opts) {
  claudeCalls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
  if (opts.headers['x-api-key'] !== 'sk-ant-test-1234') {
    return responseLike(401, JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
  }
  return responseLike(200, JSON.stringify({ content: [{ type: 'text', text: claudeAnswer }], usage: { input_tokens: 10, output_tokens: 20 } }));
}

/* ======================================================================
 * Engine tests
 * ==================================================================== */

test('envelope: escapes SQL, keeps it exact, sends report path and byPassCache', () => {
  const sql = `SELECT 'a<b & c>d' AS x, "Q" FROM dual WHERE 1 < 2`;
  const env = E.buildEnvelope('/Custom/FusionSQL/FUSION_SQL_RPT.xdo', [
    { name: 'p_sql', value: sql },
    { name: 'p_max_rows', value: '501' },
  ]);
  const read = readEnvelope(env);
  assert.strictEqual(read.params.p_sql, sql);
  assert.strictEqual(read.params.p_max_rows, '501');
  assert.strictEqual(read.reportPath, '/Custom/FusionSQL/FUSION_SQL_RPT.xdo');
  assert.strictEqual(read.byPassCache, 'true');
  assert.ok(env.includes('http://www.w3.org/2003/05/soap-envelope'), 'SOAP 1.2 envelope');
  assert.ok(env.includes('<pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>'));
});

test('prepareSql: trims terminators, applies the row limit both ways', () => {
  const s = E.normalizeSettings({ maxRows: 500 });
  let p = E.prepareSql('select 1 from dual;\n', s);
  assert.strictEqual(p.params[0].value, 'select 1 from dual');
  assert.deepStrictEqual(p.params[1], { name: 'p_max_rows', value: '501' });
  p = E.prepareSql('select 1 from dual\n/\n', s);
  assert.strictEqual(p.params[0].value, 'select 1 from dual');
  p = E.prepareSql('select 4/2 from dual', s);
  assert.strictEqual(p.params[0].value, 'select 4/2 from dual');
  p = E.prepareSql('select a.id, b.id from a, b', E.normalizeSettings({ limitMode: 'wrap', maxRows: 10 }));
  assert.strictEqual(p.params.length, 1);
  assert.ok(/^SELECT \* FROM \(\nselect a\.id, b\.id from a, b\n\) WHERE ROWNUM <= 11$/.test(p.params[0].value));
});

test('prepareSql: rejects DML, binds and several statements, allows colons in strings and WITH FUNCTION', () => {
  const s = E.normalizeSettings({});
  assert.throws(() => E.prepareSql('update x set a = 1', s), /Only SELECT/);
  assert.throws(() => E.prepareSql('  ', s), /Type a SELECT/);
  assert.throws(() => E.prepareSql('select * from x where id = :p_id', s), /:p_id/);
  assert.throws(() => E.prepareSql('select 1 from dual; select 2 from dual', s), /one statement/);
  E.prepareSql("select to_char(sysdate, 'HH24:MI:SS') from dual", s);
  E.prepareSql("select q'[a:b; c]' from dual -- note: x;\n", s);
  E.prepareSql('/* header: v1; */ with t as (select 1 a from dual) select * from t', s);
  E.prepareSql('with function f return number is begin return 1; end;\nselect f from dual', s);
  E.prepareSql('(select 1 from dual)', s);
});

test('prepareSql: warns about very long queries', () => {
  const long = `select ${'x, '.repeat(1500)}1 from dual`;
  const p = E.prepareSql(long, E.normalizeSettings({}));
  assert.strictEqual(p.warnings.length, 1);
  assert.ok(/bytes/.test(p.warnings[0]));
});

test('decodeColumnName: DBMS_XMLGEN escapes', () => {
  assert.strictEqual(E.decodeColumnName('COUNT_x0028__x002A__x0029_'), 'COUNT(*)');
  assert.strictEqual(E.decodeColumnName('_x0027_HELLO_x0027_'), "'HELLO'");
  assert.strictEqual(E.decodeColumnName('PLAIN_NAME'), 'PLAIN_NAME');
});

test('parse: ROWSET as escaped text, NULLs, Arabic, numbers, escaped names', () => {
  const xml = reportXml('select ...', '501', rowsetXml(PERIODS.slice(0, 6), Object.keys(PERIODS[0])));
  const out = E.parseReportXml(xml, ['p_sql', 'p_max_rows']);
  assert.strictEqual(out.shape, 'rowset');
  assert.deepStrictEqual(
    out.columns.map((c) => c.name),
    ['LEDGER_NAME', 'PERIOD_NAME', 'CLOSING_STATUS', 'AMOUNT', 'COUNT(*)'],
  );
  assert.deepStrictEqual(
    out.columns.map((c) => c.numeric),
    [false, false, false, true, true],
  );
  assert.strictEqual(out.rows.length, 6);
  assert.strictEqual(out.rows[0].c0, 'دفتر الأستاذ');
  assert.strictEqual(out.rows[4].c3, null);
  assert.strictEqual(out.rows[5].__n, 6);
});

test('parse: ROWSET as child elements, missing columns keep their place', () => {
  const xml =
    `<DATA_DS><P_SQL>x</P_SQL><G_1><RESULT><ROWSET xmlns:xsi="${XSI}">` +
    '<ROW><A>1</A><C>3</C></ROW><ROW><A>4</A><B>5</B><C>6</C></ROW></ROWSET></RESULT></G_1></DATA_DS>';
  const out = E.parseReportXml(xml, ['p_sql']);
  assert.deepStrictEqual(
    out.columns.map((c) => c.name),
    ['A', 'B', 'C'],
  );
  assert.strictEqual(out.rows[0].c1, null);
  assert.strictEqual(out.rows[1].c1, '5');
});

test('parse: empty RESULT means no rows', () => {
  const out = E.parseReportXml(reportXml('select', '', ''), ['p_sql', 'p_max_rows']);
  assert.strictEqual(out.rows.length, 0);
  assert.strictEqual(out.columns.length, 0);
});

test('parse: an ordinary report (row groups) works too, parameters are skipped', () => {
  const xml =
    '<DATA_DS><P_SQL>select</P_SQL><P_FROM>2026-01-01</P_FROM>' +
    '<G_1><ITEM>A1</ITEM><QTY>3</QTY></G_1><G_1><ITEM>B2</ITEM><UOM>EA</UOM><QTY>4.5</QTY></G_1></DATA_DS>';
  const out = E.parseReportXml(xml, ['p_sql']);
  assert.strictEqual(out.shape, 'groups');
  assert.deepStrictEqual(
    out.columns.map((c) => c.name),
    ['ITEM', 'UOM', 'QTY'],
  );
  assert.strictEqual(out.rows[0].c1, null);
  assert.strictEqual(out.columns[2].numeric, true);
});

test('faults: ORA lines without the ORA-06512 stack', () => {
  const msg = E.cleanFault('xx ORA-00904: "BAD": invalid identifier\nORA-06512: at line 9\nORA-06512: at line 1', '/x.xdo');
  assert.strictEqual(msg, 'ORA-00904: "BAD": invalid identifier');
  assert.ok(/could not find \/x\.xdo/.test(E.cleanFault('Report /x.xdo does not exist', '/x.xdo')));
});

test('runSql (direct): full round trip with truncation detection', async () => {
  useMockFusion();
  storage.clear();
  const r = await app.runSql('SELECT * FROM gl_period_statuses;', { maxRows: 10 });
  assert.strictEqual(r.rows.length, 10);
  assert.strictEqual(r.truncated, true);
  assert.strictEqual(r.columns.length, 5);
  const last = readEnvelope(sent[sent.length - 1].opts.body);
  assert.strictEqual(last.params.p_max_rows, '11');
  assert.strictEqual(sent[sent.length - 1].url, 'http://localhost:8890/bip');
  assert.strictEqual(sent[sent.length - 1].opts.headers['Content-Type'], 'application/soap+xml; charset=UTF-8');
  const all = await app.runSql('SELECT * FROM gl_period_statuses', { maxRows: 500 });
  assert.strictEqual(all.rows.length, 30);
  assert.strictEqual(all.truncated, false);
});

test('runSql (direct): faults, wrong report, HTTP errors, network failure', async () => {
  useMockFusion();
  await assert.rejects(app.runSql('select bad_column from dual'), /^Error: ORA-00904: "BAD_COLUMN": invalid identifier$/);
  await assert.rejects(app.runSql('select 1 from dual', { reportPath: '/Custom/Nope.xdo' }), /could not find \/Custom\/Nope\.xdo/);
  fetchImpl = async () => responseLike(401, '<html><body>Unauthorized</body></html>', 'text/html');
  await assert.rejects(app.runSql('select 1 from dual'), /HTTP 401/);
  fetchImpl = async () => responseLike(500, '');
  await assert.rejects(app.runSql('select 1 from dual'), /HTTP 500/);
  fetchImpl = async () => responseLike(500, soapFault11('Report /Custom/FusionSQL/FUSION_SQL_RPT.xdo not found in catalog'));
  await assert.rejects(app.runSql('select 1 from dual'), /could not find/);
  fetchImpl = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(app.runSql('select 1 from dual'), /npm run proxy/);
  useMockFusion();
});

test('runSql (service): REST helper gets the envelope, header and text format', async () => {
  const calls = {};
  restImpl = {
    get: (id) => {
      calls.id = id;
      return {
        body(b) {
          calls.body = b;
          return this;
        },
        initConfiguration(c) {
          calls.init = c;
          return this;
        },
        responseBodyFormat(f) {
          calls.format = f;
          return this;
        },
        fetch: async () => {
          const a = fusion(calls.body);
          return { response: { ok: true, status: 200 }, body: a.body };
        },
      };
    },
  };
  const r = await app.runSql('select 1 as x from dual', { transport: 'service' });
  assert.strictEqual(calls.id, 'fusionBip/runReport');
  assert.strictEqual(calls.init.headers['Content-Type'], 'application/soap+xml; charset=UTF-8');
  assert.strictEqual(calls.format, 'text');
  assert.strictEqual(r.rows[0].c0, 'hello');

  // The helper rejects on HTTP 500 and carries the SOAP fault in the body.
  restImpl.get = (id) => ({
    body() {
      return this;
    },
    fetch: async () => {
      throw { response: { ok: false, status: 500 }, body: fusion(E.buildEnvelope('/Custom/FusionSQL/FUSION_SQL_RPT.xdo', [{ name: 'p_sql', value: 'select bad_column from x' }])).body };
    },
  });
  await assert.rejects(app.runSql('select bad_column from x', { transport: 'service' }), /ORA-00904/);

  restImpl.get = () => {
    throw new Error('Service "fusionBip" not found');
  };
  await assert.rejects(app.runSql('select 1 from dual', { transport: 'service' }), /fusionBip\/runReport is not available/);
});

test('settings: defaults, clamping, direct on localhost, service elsewhere', () => {
  storage.clear();
  assert.strictEqual(app.settings().transport, 'direct');
  globalThis.window.location.hostname = 'vb.example.oraclecloud.com';
  assert.strictEqual(app.settings().transport, 'service');
  globalThis.window.location.hostname = 'localhost';
  const s = app.saveSettings({ maxRows: 999999, timeoutSec: 1, reportPath: '  ', transport: 'service' });
  assert.strictEqual(s.maxRows, 10000);
  assert.strictEqual(s.timeoutSec, 10);
  assert.strictEqual(s.reportPath, '/Custom/FusionSQL/FUSION_SQL_RPT.xdo');
  assert.ok(/Service connection: fusionBip\/runReport/.test(app.connectionLabel(s)));
  assert.strictEqual(app.setMaxRows(0), 1);
  storage.clear();
});

test('history: newest first, no duplicates, at most 40', () => {
  storage.clear();
  for (let i = 0; i < 45; i += 1) {
    app.addHistory({ sql: `select ${i} from dual`, ok: true, rows: 1, ms: 5 });
  }
  app.addHistory({ sql: 'select 10 from dual', ok: false, error: 'ORA-1' });
  const h = app.history();
  assert.strictEqual(h.length, 40);
  assert.strictEqual(h[0].sql, 'select 10 from dual');
  assert.strictEqual(h[0].ok, false);
  assert.strictEqual(h.filter((x) => x.sql === 'select 10 from dual').length, 1);
  storage.clear();
});

test('dictionary SQL: safe names only', () => {
  assert.ok(/LIKE '%PO_HEADERS%'/.test(E.tablesSql('po headers')));
  assert.throws(() => E.tablesSql('p'), /two letters/);
  const injected = E.tablesSql("PO' OR 1=1 --");
  assert.ok(injected.includes("LIKE '%PO_OR_11_%'"), injected);
  assert.ok(!/OR 1=1|--/.test(injected));
  assert.ok(/owner = 'FUSION'/.test(E.columnsSql('fusion', 'po_headers_all')));
  assert.throws(() => E.columnsSql('FUSION', "X' OR '1'='1"), /not a valid table/);
});

test('Claude: request, context and SQL extraction', async () => {
  storage.clear();
  useMockFusion();
  await assert.rejects(app.askClaude({ mode: 'write', question: 'x' }), /Add a Claude API key/);
  app.saveClaude({ apiKey: 'sk-ant-test-1234', model: 'claude-opus-5-5', remember: true });
  assert.strictEqual(app.claudeSettings().keyHint, '…1234');
  const out = await app.askClaude({
    mode: 'write',
    question: 'latest POs',
    tables: [{ name: 'PO_HEADERS_ALL', columns: [{ name: 'SEGMENT1', type: 'VARCHAR2(30)' }] }],
  });
  assert.strictEqual(out.sql, 'SELECT segment1 AS po_number\n  FROM po_headers_all\n ORDER BY creation_date DESC');
  assert.strictEqual(out.note, 'Assumes all business units.');
  const call = claudeCalls[claudeCalls.length - 1];
  assert.strictEqual(call.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(call.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.strictEqual(call.body.model, 'claude-opus-5-5');
  assert.ok(/ApplicationDB_FSCM/.test(call.body.system));
  assert.ok(/Columns of PO_HEADERS_ALL: SEGMENT1 VARCHAR2\(30\)/.test(call.body.messages[0].content));
  assert.ok(/latest POs/.test(call.body.messages[0].content));
  assert.deepStrictEqual(E.extractSql('SELECT 1 FROM dual;'), { sql: 'SELECT 1 FROM dual', note: '' });
  app.saveClaude({ apiKey: 'wrong', remember: true });
  await assert.rejects(app.askClaude({ mode: 'write', question: 'x' }), /401/);
  app.removeClaudeKey();
  assert.strictEqual(app.claudeSettings().hasKey, false);
  // "Remember" off: the key works until reload but is not stored.
  app.saveClaude({ apiKey: 'sk-ant-test-1234', remember: false });
  assert.ok(!String(storage.get('fq-claude-v1')).includes('sk-ant'));
  assert.strictEqual(app.claudeSettings().hasKey, true);
  app.removeClaudeKey();
});

/* ======================================================================
 * Page module tests
 * ==================================================================== */

test('pickStatement: selection, statement at the cursor, quotes, comments, "/" lines', () => {
  const text = "select 1 from dual;\nselect ';' as semi from dual -- ; in a comment\n;\n\nselect 3 from dual";
  assert.deepStrictEqual(page.pickStatement(text, 0, 8), { sql: 'select 1', scope: 'selection' });
  assert.strictEqual(page.pickStatement(text, 3, 3).sql, 'select 1 from dual');
  assert.strictEqual(page.pickStatement(text, 19, 19).sql, 'select 1 from dual');
  const second = page.pickStatement(text, 25, 25);
  assert.strictEqual(second.scope, 'statement');
  assert.ok(second.sql.startsWith("select ';' as semi"));
  assert.strictEqual(page.pickStatement(text, text.length, text.length).sql, 'select 3 from dual');
  assert.deepStrictEqual(page.pickStatement('select 4/2 from dual', 0, 0), { sql: 'select 4/2 from dual', scope: 'all' });
  const slashed = 'select 1 from dual\n/\nselect 2 from dual\n/\n';
  assert.strictEqual(page.pickStatement(slashed, slashed.length - 3, slashed.length - 3).sql, 'select 2 from dual');
  const wf = 'with function f return number is begin return 1; end;\nselect f from dual';
  assert.strictEqual(page.pickStatement(wf, 0, 0).sql, wf);
  assert.strictEqual(page.pickStatement('select 1 from dual;\n\n   ', 22, 22).sql, 'select 1 from dual');
});

test('grid helpers: columns, sorting comparators, filter, summary', () => {
  const r = E.parseReportXml(reportXml('s', '', rowsetXml(PERIODS.slice(0, 6), Object.keys(PERIODS[0]))), ['p_sql']);
  const cols = page.tableColumns(r.columns);
  assert.strictEqual(cols[0].field, '__n');
  assert.strictEqual(cols[4].className, 'oj-helper-text-align-end fq-num');
  const adp = page.makeADP(r.rows, r.columns);
  assert.strictEqual(adp.options.keyAttributes, '__n');
  const cmpNum = adp.options.sortComparators.comparators.get('c3');
  const sorted = r.rows.map((x) => x.c3).sort(cmpNum);
  assert.deepStrictEqual(sorted, ['0.00', '1250.50', '2501.00', '3751.50', '6252.50', null]);
  const cmpText = adp.options.sortComparators.comparators.get('c1');
  assert.ok(cmpText('P-2', 'P-10') < 0, 'natural sort');
  assert.strictEqual(page.filterRows(r.rows, r.columns, 'buimerc').length, 3);
  assert.strictEqual(page.filterRows(r.rows, r.columns, '').length, 6);
  const info = page.resultInfo({ rows: r.rows, ms: 1430, truncated: true, maxRows: 6, warnings: [] }, 'statement', 6);
  assert.strictEqual(info.summary, '6 rows · 1.4 s · stopped at 6; raise Max rows for more · ran the statement at the cursor');
  const filtered = page.withFilterInfo(info, 2);
  assert.ok(filtered.summary.endsWith('· 2 match the filter'));
  assert.strictEqual(page.withFilterInfo(filtered, 6).summary, info.summary);
});

test('export: CSV quoting and tab-separated copy', () => {
  const cols = [
    { key: 'c0', name: 'NAME' },
    { key: 'c1', name: 'NOTE' },
  ];
  const rows = [
    { c0: 'A, "B"', c1: null },
    { c0: 'line\nbreak', c1: 'tab\there' },
  ];
  assert.strictEqual(page.toDelimited(cols, rows, ','), 'NAME,NOTE\r\n"A, ""B""",\r\n"line\nbreak",tab\there');
  assert.strictEqual(page.toDelimited(cols, rows, '\t'), 'NAME\tNOTE\r\nA, "B"\t\r\nline break\ttab here');
  assert.ok(/^fusion-sql-\d{8}-\d{4}\.csv$/.test(page.fileName('csv')));
});

test('dictionary helpers: describe, SELECT builder, Claude context', () => {
  const result = {
    columns: [
      { key: 'c0', name: 'COLUMN_NAME' },
      { key: 'c1', name: 'DATA_TYPE' },
      { key: 'c2', name: 'DATA_LENGTH' },
      { key: 'c3', name: 'DATA_PRECISION' },
      { key: 'c4', name: 'DATA_SCALE' },
      { key: 'c5', name: 'NULLABLE' },
    ],
    rows: [
      { c0: 'AMOUNT', c1: 'NUMBER', c2: '22', c3: '18', c4: '2', c5: 'Y' },
      { c0: 'CODE', c1: 'VARCHAR2', c2: '30', c3: null, c4: null, c5: 'N' },
    ],
  };
  const d = page.describedFrom('FUSION', 'XX_T', result);
  assert.deepStrictEqual(
    d.columns.map((c) => c.type),
    ['NUMBER(18,2)', 'VARCHAR2(30)'],
  );
  assert.strictEqual(d.columns[1].nullable, false);
  assert.strictEqual(page.selectFor(d), 'SELECT AMOUNT,\n       CODE\n  FROM XX_T');
  assert.strictEqual(page.selectFor(Object.assign({}, d, { owner: 'FUSION_RO' })), 'SELECT AMOUNT,\n       CODE\n  FROM FUSION_RO.XX_T');
  const many = Object.assign({}, d, { columns: new Array(41).fill(0).map((x, i) => ({ name: `C${i}` })) });
  assert.strictEqual(page.selectFor(many), 'SELECT *\n  FROM XX_T');
  let mem = [];
  ['A', 'B', 'C', 'D', 'E', 'B'].forEach((n) => (mem = page.rememberTable(mem, { name: n, columns: [] })));
  assert.deepStrictEqual(
    mem.map((t) => t.name),
    ['B', 'E', 'D', 'C'],
  );
  assert.strictEqual(page.replaceStatement('select 1;\nselect bad;', 'select bad', 'select good'), 'select 1;\nselect good;');
  assert.strictEqual(page.replaceStatement('x', 'missing', 'new'), 'new');
});

/* ======================================================================
 * Chains against a mock VB context
 * ==================================================================== */

const pageJson = JSON.parse(fs.readFileSync(path.join(PAGE, 'fusion-sql-page.json'), 'utf8'));
const chainDeps = { 'vb/action/actionChain': class {}, 'vb/action/actions': {}, 'vb/action/actionUtils': {} };
const chains = {};
fs.readdirSync(CHAINS).forEach((f) => {
  chains[f.replace(/\.js$/, '')] = loadAmd(path.join(CHAINS, f), chainDeps);
});

function makeContext() {
  const variables = {};
  Object.entries(pageJson.variables).forEach(([k, v]) => {
    variables[k] = v.type === 'vb/ArrayDataProvider2' ? { data: [] } : JSON.parse(JSON.stringify(v.defaultValue));
  });
  return { $page: { variables, functions: page }, $application: { functions: app } };
}

async function fire(ctx, listener, event, current) {
  const def = pageJson.eventListeners[listener];
  assert.ok(def, `listener ${listener}`);
  for (const c of def.chains) {
    const params = {};
    Object.entries(c.parameters || {}).forEach(([k, expr]) => {
      if (typeof expr !== 'string') {
        params[k] = expr;
        return;
      }
      const m = expr.match(/^\{\{\s*(.*?)\s*\}\}$/);
      if (!m) {
        params[k] = expr;
        return;
      }
          params[k] = new Function('$event', '$current', '$variables', `return (${m[1]});`)(event || {}, current || {}, ctx.$page.variables);
    });
    const Chain = chains[c.chain];
    assert.ok(Chain, `chain ${c.chain}`);
    await new Chain().run(ctx, params);
  }
}

test('chains: the whole page journey', async () => {
  storage.clear();
  useMockFusion();
  const ctx = makeContext();
  const v = ctx.$page.variables;

  await fire(ctx, 'vbEnter');
  assert.ok(/db_user/i.test(v.sql));
  assert.strictEqual(v.starters.length, 7);
  assert.ok(v.connection.startsWith('Direct: http://localhost:8890/bip'));
  assert.strictEqual(v.modelsADP.data.length, 3);

  // Typing, then a key that is not Ctrl+Enter: nothing runs.
  editor.value = 'select * from periods;\nselect 1 as x from dual';
  editor.selectionStart = editor.selectionEnd = 5;
  await fire(ctx, 'editorKeydown', { key: 'a', ctrlKey: true });
  assert.strictEqual(v.result.ran, false);

  // Ctrl+Enter runs the statement at the cursor (uncommitted text read from the textarea).
  await fire(ctx, 'editorKeydown', { key: 'Enter', ctrlKey: true });
  assert.strictEqual(v.result.ran, true);
  assert.strictEqual(v.result.rows, 30);
  assert.strictEqual(v.result.scope, 'statement');
  assert.strictEqual(v.columns.length, 6);
  assert.strictEqual(v.tableADP.data.length, 30);
  assert.strictEqual(v.history[0].sql, 'select * from periods');
  assert.strictEqual(app.draft(), editor.value);
  assert.strictEqual(v.running, false);

  // Filter, copy, CSV.
  await fire(ctx, 'filterChanged', { detail: { value: 'buimerc' } });
  assert.strictEqual(v.tableADP.data.length, 15);
  assert.ok(v.result.summary.endsWith('15 match the filter'));
  v.filterText = 'buimerc';
  await fire(ctx, 'copyResults');
  assert.strictEqual(clipboard.text.split('\r\n').length, 16);
  assert.strictEqual(v.messages[0].severity, 'confirmation');
  await fire(ctx, 'exportCsv');
  assert.strictEqual(downloads.length, 1);
  assert.ok(created.some((el) => el.tag === 'a' && el.clicked && /\.csv$/.test(el.download)));

  // Run button with a selection.
  editor.selectionStart = 23;
  editor.selectionEnd = editor.value.length;
  await fire(ctx, 'runClick');
  assert.strictEqual(v.result.scope, 'selection');
  assert.strictEqual(v.result.rows, 1);
  editor.selectionStart = editor.selectionEnd = 0;

  // Error, then "Fix with Claude" without a key: settings open with a hint.
  editor.value = 'select bad_column from dual';
  await fire(ctx, 'runClick');
  assert.strictEqual(v.error.show, true);
  assert.ok(/ORA-00904/.test(v.error.message));
  assert.strictEqual(v.history[0].ok, false);
  await fire(ctx, 'fixClick');
  assert.strictEqual(dialog.opened, true);
  assert.ok(/Claude API key/.test(v.settingsStatus));

  // Settings: test the connection, add a Claude key (typed, not committed), save.
  await fire(ctx, 'openSettings');
  assert.strictEqual(v.settingsForm.transport, 'direct');
  await fire(ctx, 'testConnection');
  assert.strictEqual(v.settingsOk, true);
  assert.ok(/Connected\. .*2026-10-15 18:30:00/.test(v.settingsStatus));
  v.settingsForm.reportPath = '/Custom/Wrong.xdo';
  await fire(ctx, 'testConnection');
  assert.strictEqual(v.settingsOk, false);
  v.settingsForm.reportPath = '/Custom/FusionSQL/FUSION_SQL_RPT.xdo';
  keyField.rawValue = 'sk-ant-test-1234';
  await fire(ctx, 'testClaude');
  assert.strictEqual(v.settingsOk, true);
  v.settingsForm.maxRows = 250;
  await fire(ctx, 'saveSettings');
  keyField.rawValue = '';
  assert.strictEqual(dialog.opened, false);
  assert.strictEqual(v.claude.hasKey, true);
  assert.strictEqual(v.maxRows, 250);
  assert.strictEqual(v.messages[0].summary, 'Settings saved');

  // Fix with Claude: the failed statement is replaced in place.
  claudeAnswer = '```sql\nSELECT dummy AS fixed FROM dual\n```';
  editor.value = 'select 1 from dual;\nselect bad_column from dual';
  v.sql = editor.value;
  await fire(ctx, 'fixClick');
  assert.strictEqual(v.sql, 'select 1 from dual;\nSELECT dummy AS fixed FROM dual');
  assert.strictEqual(v.error.show, false);
  assert.ok(/Claude rewrote|Claude wrote|Claude:/.test(v.askNote));
  const fixCall = claudeCalls[claudeCalls.length - 1].body.messages[0].content;
  assert.ok(/ORA-00904/.test(fixCall) && /bad_column/.test(fixCall));

  // Write SQL from a sentence (Enter in the question field), added under the editor text.
  claudeAnswer = '```sql\nSELECT segment1 FROM po_headers_all\n```\nUses PO_HEADERS_ALL.';
  editor.value = v.sql;
  askField.rawValue = 'latest purchase orders';
  await fire(ctx, 'askKeydown', { key: 'Enter', shiftKey: true });
  assert.strictEqual(claudeCalls.length, 4, 'Shift+Enter does not send');
  await fire(ctx, 'askKeydown', { key: 'Enter', shiftKey: false });
  assert.strictEqual(v.sql, 'select 1 from dual;\nSELECT dummy AS fixed FROM dual;\n\nSELECT segment1 FROM po_headers_all');
  assert.strictEqual(v.askNote, 'Claude: Uses PO_HEADERS_ALL.');
  askField.rawValue = '';

  // History: open, load, run again, close.
  await fire(ctx, 'showHistory');
  assert.strictEqual(v.panel, 'history');
  const entry = v.history.find((h) => h.sql === 'select * from periods');
  await fire(ctx, 'historyLoad', null, { data: entry });
  assert.strictEqual(v.sql, 'select * from periods');
  await fire(ctx, 'historyRun', null, { data: { sql: 'select 1 as x from dual' } });
  assert.strictEqual(v.sql, 'select 1 as x from dual');
  assert.strictEqual(v.result.rows, 1);
  await fire(ctx, 'showHistory');
  assert.strictEqual(v.panel, '');

  // Tables: search (Enter), open one, type a column, write a SELECT, back.
  await fire(ctx, 'showTables');
  await fire(ctx, 'tablesSearch', { detail: { value: 'po_headers' } });
  assert.strictEqual(v.tables.length, 3);
  assert.strictEqual(v.tables[2].type, 'View');
  assert.ok(/3 found/.test(v.tablesNote));
  await fire(ctx, 'tableOpen', null, { data: v.tables[0] });
  assert.strictEqual(v.described.name, 'PO_HEADERS_ALL');
  assert.strictEqual(v.described.columns.length, 4);
  assert.strictEqual(v.described.columns[0].type, 'NUMBER(18)');
  assert.strictEqual(v.claudeTables[0].name, 'PO_HEADERS_ALL');
  editor.value = 'select  from po_headers_all';
  editor.selectionStart = editor.selectionEnd = 7;
  await fire(ctx, 'columnInsert', null, { data: { name: 'SEGMENT1' } });
  assert.strictEqual(v.sql, 'select SEGMENT1 from po_headers_all');
  editor.value = v.sql;
  await fire(ctx, 'tableInsert');
  assert.ok(v.sql.startsWith('select SEGMENT1 from po_headers_all;\n\nSELECT PO_HEADER_ID,'));
  assert.ok(v.sql.endsWith('  FROM PO_HEADERS_ALL'));
  await fire(ctx, 'tableBack');
  assert.strictEqual(v.described, null);
  tableSearchField.rawValue = 'x';
  await fire(ctx, 'tablesSearchClick');
  assert.ok(/two letters/.test(v.tablesNote));
  tableSearchField.rawValue = '';

  // Examples, row limit, clear.
  editor.value = 'select 1 from dual';
  await fire(ctx, 'starterClick', null, { data: { id: 'periods' } });
  assert.ok(v.sql.startsWith('select 1 from dual;\n\nSELECT gl.name AS ledger_name'));
  await fire(ctx, 'maxRowsChanged', { detail: { value: 20000 } });
  assert.strictEqual(v.maxRows, 10000);
  assert.strictEqual(app.settings().maxRows, 10000);
  await fire(ctx, 'maxRowsChanged', { detail: { value: null } });
  assert.strictEqual(v.maxRows, 10000);
  await fire(ctx, 'clearClick');
  assert.strictEqual(v.sql, '');
  assert.strictEqual(app.draft(), '');

  // Settings: remove the key, reset, cancel.
  await fire(ctx, 'openSettings');
  await fire(ctx, 'removeKey');
  assert.strictEqual(v.claude.hasKey, false);
  await fire(ctx, 'resetSettings');
  assert.strictEqual(v.maxRows, 500);
  await fire(ctx, 'closeSettings');
  assert.strictEqual(dialog.opened, false);

  // Empty editor: a clear message, nothing sent.
  const before = sent.length;
  editor.value = '   ';
  await fire(ctx, 'runClick');
  assert.strictEqual(sent.length, before);
  assert.ok(/Type a SELECT/.test(v.error.message));
});

/* ======================================================================
 * Static wiring checks
 * ==================================================================== */

test('wiring: listeners, chains, parameters, functions, variables, components', () => {
  const html = fs.readFileSync(path.join(PAGE, 'fusion-sql-page.html'), 'utf8');
  const listenersUsed = new Set([...html.matchAll(/\$listeners\.(\w+)/g)].map((m) => m[1]));
  listenersUsed.forEach((l) => assert.ok(pageJson.eventListeners[l], `HTML uses missing listener ${l}`));
  Object.keys(pageJson.eventListeners)
    .filter((l) => l !== 'vbEnter')
    .forEach((l) => assert.ok(listenersUsed.has(l), `listener ${l} is never used`));

  Object.entries(pageJson.eventListeners).forEach(([name, def]) => {
    def.chains.forEach((c) => {
      const file = path.join(CHAINS, `${c.chain}.js`);
      assert.ok(fs.existsSync(file), `${name} -> missing chain file ${c.chain}`);
      const src = fs.readFileSync(file, 'utf8');
      assert.ok(new RegExp(`class ${c.chain} extends ActionChain`).test(src), `class name of ${c.chain}`);
      assert.ok(new RegExp(`return ${c.chain};`).test(src), `${c.chain} returns its class`);
      const m = src.match(/async run\(context(?:, \{([^}]*)\} = \{\})?\)/);
      const accepted = m && m[1] ? m[1].split(',').map((s) => s.trim()) : [];
      Object.keys(c.parameters || {}).forEach((p) => assert.ok(accepted.includes(p), `${c.chain} does not take ${p}`));
    });
  });

  const fnsUsed = new Set([...html.matchAll(/\$functions\.(\w+)/g)].map((m) => m[1]));
  fnsUsed.forEach((f) => assert.strictEqual(typeof page[f], 'function', `$functions.${f}`));
  const chainSrc = fs.readdirSync(CHAINS).map((f) => fs.readFileSync(path.join(CHAINS, f), 'utf8')).join('\n');
  new Set([...chainSrc.matchAll(/\$page\.functions\.(\w+)/g)].map((m) => m[1])).forEach((f) =>
    assert.strictEqual(typeof page[f], 'function', `$page.functions.${f}`),
  );
  new Set([...chainSrc.matchAll(/\$application\.functions\.(\w+)/g)].map((m) => m[1])).forEach((f) =>
    assert.strictEqual(typeof app[f], 'function', `$application.functions.${f}`),
  );
  const varsUsed = new Set([...html.matchAll(/\$variables\.(\w+)/g)].map((m) => m[1]).concat([...chainSrc.matchAll(/\$page\.variables\.(\w+)/g)].map((m) => m[1])));
  varsUsed.forEach((v) => assert.ok(pageJson.variables[v], `variable ${v} is not declared`));

  const builtIn = new Set(['oj-bind-text', 'oj-bind-if', 'oj-bind-for-each']);
  const tags = new Set([...html.matchAll(/<(oj-[a-z-]+)/g)].map((m) => m[1]).filter((t) => !builtIn.has(t)));
  tags.forEach((t) => assert.ok(pageJson.imports.components[t], `component ${t} is not imported`));
  Object.keys(pageJson.imports.components).forEach((t) => assert.ok(tags.has(t), `import ${t} is not used`));

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  ['sqlEditor', 'settingsDialog', 'askField', 'claudeKeyField', 'tableSearchField'].forEach((id) => assert.ok(ids.has(id), `#${id}`));

  const css = fs.readFileSync(path.join(APP, 'resources', 'css', 'app.css'), 'utf8');
  const classes = new Set([...html.matchAll(/\bfq-[a-z0-9-]+/g)].map((m) => m[0]));
  const pageJs = fs.readFileSync(path.join(PAGE, 'fusion-sql-page.js'), 'utf8');
  [...pageJs.matchAll(/'(fq-[a-z0-9-]+)/g)].forEach((m) => classes.add(m[1]));
  classes.forEach((c) => assert.ok(css.includes(`.${c}`), `CSS class .${c} is not defined`));

  ['app-flow.json', 'pages/fusion-sql-page.json', 'settings/dependencies.json', 'resources/strings/app/nls/root/app-strings.json'].forEach((f) =>
    JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8')),
  );
  ['visual-application.json', 'settings/dependencies.json', 'settings/deployment-profiles.json', 'settings/user-roles.json', 'package.json'].forEach((f) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')),
  );
});

/* ======================================================================
 * Dev proxy against a mock Fusion server
 * ==================================================================== */

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('dev proxy: CORS, only runReport, credentials added, end to end', async () => {
  const seen = [];
  const mockFusion = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      seen.push({ url: req.url, headers: req.headers, body });
      const answer = fusion(body);
      res.writeHead(answer.status, { 'Content-Type': 'application/soap+xml; charset=UTF-8' });
      res.end(answer.body);
    });
  });
  const fusionPort = await listen(mockFusion);
  const { createServer } = require(path.join(ROOT, 'tools', 'bip-dev-proxy.js'));
  const proxy = createServer({ base: `http://127.0.0.1:${fusionPort}`, user: 'emparun', password: 'secret', port: 0 });
  const proxyPort = await listen(proxy);
  const base = `http://127.0.0.1:${proxyPort}`;
  const realFetch = globalThis.fetch;

  try {
    let r = await realFetch(`${base}/bip`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8888' } });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), 'http://localhost:8888');

    r = await realFetch(`${base}/bip`, { method: 'POST', headers: { Origin: 'https://evil.example.com' }, body: '<x/>' });
    assert.strictEqual(r.status, 403);

    r = await realFetch(`${base}/bip`, { method: 'POST', headers: { Origin: 'http://localhost:8888' }, body: '<soap:Envelope><soap:Body><pub:getReportDefinition/></soap:Body></soap:Envelope>' });
    assert.strictEqual(r.status, 400);
    assert.ok(/only forwards runReport/.test(await r.text()));
    assert.strictEqual(seen.length, 0);

    r = await realFetch(`${base}/health`);
    assert.deepStrictEqual(await r.json(), { ok: true, target: `http://127.0.0.1:${fusionPort}/xmlpserver/services/ExternalReportWSSService`, user: 'emparun' });

    // The app, through the real proxy, to the mock Fusion.
    storage.clear();
    fetchImpl = (url, opts) => realFetch(url, Object.assign({}, opts, { headers: Object.assign({ Origin: 'http://localhost:8888' }, opts.headers) }));
    const result = await app.runSql('select * from periods', { directUrl: `${base}/bip`, maxRows: 5 });
    assert.strictEqual(result.rows.length, 5);
    assert.strictEqual(result.truncated, true);
    assert.strictEqual(result.rows[0].c0, 'دفتر الأستاذ');
    const hit = seen[seen.length - 1];
    assert.strictEqual(hit.url, '/xmlpserver/services/ExternalReportWSSService');
    assert.strictEqual(hit.headers.authorization, `Basic ${Buffer.from('emparun:secret').toString('base64')}`);
    assert.strictEqual(hit.headers['content-type'], 'application/soap+xml; charset=UTF-8');
    await assert.rejects(app.runSql('select bad_column from dual', { directUrl: `${base}/bip` }), /ORA-00904/);

    // No credentials configured: a SOAP fault the app shows as is.
    const bare = createServer({ base: '', user: '', password: '', port: 0 });
    const barePort = await listen(bare);
    await assert.rejects(app.runSql('select 1 from dual', { directUrl: `http://127.0.0.1:${barePort}/bip` }), /\.env/);
    bare.close();
  } finally {
    proxy.close();
    mockFusion.close();
    useMockFusion();
  }
});

/* ======================================================================
 * Run
 * ==================================================================== */

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ok  ${t.name}`);
    } catch (e) {
      failed += 1;
      console.log(`FAIL  ${t.name}\n      ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n      ') : e}`);
    }
  }
  URL.createObjectURL = realCreateObjectURL;
  console.log(`\n${tests.length - failed} of ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
