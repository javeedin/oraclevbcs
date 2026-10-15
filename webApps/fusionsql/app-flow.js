// 'vb/helpers/rest' is Visual Builder's REST helper. Oracle's guidance for SOAP services in VB:
// define a service connection to the SOAP endpoint, call it with the REST helper from JavaScript,
// and build / parse the XML yourself. That is what this module does.
define(['vb/helpers/rest'], (Rest) => {
  'use strict';

  /* ======================================================================
   * Fusion SQL - application module
   *
   * Runs a SELECT on Oracle Fusion by calling a BI Publisher report over SOAP:
   *
   *   SQL text --> runReport (ExternalReportWSSService, SOAP 1.2)
   *            --> universal report: data model runs p_sql through DBMS_XMLGEN
   *            <-- reportBytes (base64 of the report XML)
   *            <-- DATA_DS/G_1/RESULT holds a ROWSET, one ROW per result row
   *
   * Two ways to reach Fusion from the browser (Settings > Connection):
   *   service  VB service connection "fusionBip", endpoint "runReport" (VB Studio).
   *            VB's proxy adds the Fusion credentials, so they never reach the browser.
   *   direct   POST to a URL, normally the local dev proxy (npm run proxy), which
   *            adds the credentials from .env. Use it for the local preview.
   *
   * Every method of AppModule is $application.functions.<name>() in pages and chains.
   * ====================================================================== */

  const SOAP12_NS = 'http://www.w3.org/2003/05/soap-envelope';
  const PUB_NS = 'http://xmlns.oracle.com/oxp/service/PublicReportService';
  const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
  const CONTENT_TYPE = 'application/soap+xml; charset=UTF-8';
  const MAX_ROWS_CAP = 10000;
  const LONG_SQL_BYTES = 4000;

  /* --------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------ */

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storageGet(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // nothing to do
    }
  }

  function isLocalHost() {
    try {
      return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    } catch {
      return false;
    }
  }

  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, n));
  }

  function unique(list) {
    return list.filter((x, i) => list.indexOf(x) === i);
  }

  /** XML 1.0 text: escape markup and drop control characters XML cannot carry. */
  function xmlText(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function utf8Length(text) {
    try {
      return new TextEncoder().encode(text).length;
    } catch {
      return text.length;
    }
  }

  function localNameOf(node) {
    return node.localName || String(node.nodeName || '').replace(/^.*:/, '');
  }

  function elementChildren(node) {
    const out = [];
    const kids = node ? node.childNodes : null;
    if (!kids) {
      return out;
    }
    for (let i = 0; i < kids.length; i += 1) {
      if (kids[i].nodeType === 1) {
        out.push(kids[i]);
      }
    }
    return out;
  }

  /** Breadth-first search for the first element with this local name (any namespace, any case). */
  function firstByLocalName(root, name) {
    const lower = name.toLowerCase();
    const start = root && root.nodeType === 9 ? root.documentElement : root;
    const queue = start ? [start] : [];
    while (queue.length) {
      const node = queue.shift();
      if (localNameOf(node).toLowerCase() === lower) {
        return node;
      }
      queue.push(...elementChildren(node));
    }
    return null;
  }

  function parseXml(text, what) {
    let doc = null;
    let failure = '';
    try {
      doc = new window.DOMParser().parseFromString(text, 'application/xml');
    } catch (e) {
      failure = e && e.message ? e.message : String(e);
    }
    if (!doc || !doc.documentElement || failure) {
      throw new Error(`Could not read the ${what} (${failure || 'not XML'}).`);
    }
    if (doc.getElementsByTagName('parsererror').length || localNameOf(doc.documentElement) === 'parsererror') {
      throw new Error(`Could not read the ${what} (not well-formed XML).`);
    }
    return doc;
  }

  /** DBMS_XMLGEN turns characters that can't be in a tag into _xHHHH_ (e.g. COUNT(*) -> COUNT_x0028__x002A__x0029_). */
  function decodeColumnName(name) {
    return String(name).replace(/_x([0-9A-Fa-f]{4})_/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function isNil(el) {
    if (!el.getAttribute) {
      return false;
    }
    let nil = '';
    if (el.getAttributeNS) {
      nil = el.getAttributeNS(XSI_NS, 'nil') || '';
    }
    if (!nil) {
      nil = el.getAttribute('xsi:nil') || el.getAttribute('nil') || '';
    }
    return nil === 'true';
  }

  /** Keeps the column order of the query even when a row leaves a column out. */
  function mergeOrder(order, names) {
    let prev = -1;
    names.forEach((name) => {
      const at = order.indexOf(name);
      if (at === -1) {
        order.splice(prev + 1, 0, name);
        prev += 1;
      } else {
        prev = at;
      }
    });
  }

  const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

  function shapeResult(order, rawRows) {
    const columns = order.map((name, i) => {
      let seen = 0;
      let numeric = true;
      for (let r = 0; r < rawRows.length && numeric; r += 1) {
        const v = rawRows[r].get(name);
        if (v !== null && v !== undefined && v !== '') {
          seen += 1;
          numeric = NUMBER_RE.test(String(v).trim());
        }
      }
      return { key: `c${i}`, name: decodeColumnName(name), numeric: numeric && seen > 0 };
    });
    const rows = rawRows.map((raw, idx) => {
      const row = { __n: idx + 1 };
      order.forEach((name, i) => {
        row[`c${i}`] = raw.has(name) ? raw.get(name) : null;
      });
      return row;
    });
    return { columns, rows };
  }

  /* --------------------------------------------------------------------
   * Report output parsing
   * ------------------------------------------------------------------ */

  /**
   * Finds the DBMS_XMLGEN ROWSET in the report XML. The universal report returns it as
   * escaped text inside DATA_DS/G_1/RESULT; a data model whose column is typed XML returns
   * it as child elements. Returns the ROWSET element, null for "no rows", or undefined when
   * the report is not a ROWSET report at all.
   */
  function findRowset(root, skipNames) {
    const stack = [root];
    let emptyResult = false;
    while (stack.length) {
      const el = stack.shift();
      const name = localNameOf(el).toUpperCase();
      if (name === 'ROWSET') {
        return el;
      }
      if (skipNames.indexOf(name) !== -1) {
        continue;
      }
      const kids = elementChildren(el);
      if (!kids.length) {
        const text = (el.textContent || '').trim();
        if (/^(<\?xml[^>]*>\s*)?<ROWSET[\s>/]/i.test(text)) {
          return parseXml(text, 'query result').documentElement;
        }
        if (name === 'RESULT' && !text) {
          emptyResult = true;
        }
      }
      stack.push(...kids);
    }
    return emptyResult ? null : undefined;
  }

  function rowsFromRowset(rowset) {
    const order = [];
    const rawRows = [];
    if (rowset) {
      elementChildren(rowset).forEach((rowEl) => {
        const values = new Map();
        const names = [];
        elementChildren(rowEl).forEach((cell) => {
          const name = localNameOf(cell);
          names.push(name);
          values.set(name, isNil(cell) ? null : cell.textContent);
        });
        mergeOrder(order, names);
        rawRows.push(values);
      });
    }
    return shapeResult(order, rawRows);
  }

  /** Any other report: the repeating group with the most rows becomes the table. */
  function rowsFromGroups(root, skipNames) {
    const groups = new Map();
    const stack = [root];
    while (stack.length) {
      const el = stack.shift();
      const kids = elementChildren(el);
      if (el !== root && kids.length && kids.every((k) => elementChildren(k).length === 0)) {
        const tag = localNameOf(el);
        if (!groups.has(tag)) {
          groups.set(tag, []);
        }
        groups.get(tag).push(el);
        continue;
      }
      stack.push(...kids);
    }
    let best = null;
    groups.forEach((list) => {
      if (!best || list.length > best.length) {
        best = list;
      }
    });
    const order = [];
    const rawRows = [];
    (best || []).forEach((rowEl) => {
      const values = new Map();
      const names = [];
      elementChildren(rowEl).forEach((cell) => {
        const name = localNameOf(cell);
        if (skipNames.indexOf(name.toUpperCase()) !== -1) {
          return;
        }
        names.push(name);
        values.set(name, isNil(cell) ? null : cell.textContent);
      });
      mergeOrder(order, names);
      rawRows.push(values);
    });
    return shapeResult(order, rawRows);
  }

  function parseReportXml(xml, paramNames) {
    const skip = (paramNames || []).map((n) => String(n).toUpperCase());
    const doc = parseXml(xml, 'report output');
    const rowset = findRowset(doc.documentElement, skip);
    if (rowset !== undefined) {
      return Object.assign(rowsFromRowset(rowset), { shape: 'rowset' });
    }
    return Object.assign(rowsFromGroups(doc.documentElement, skip), { shape: 'groups' });
  }

  function decodeBase64Utf8(base64) {
    const clean = String(base64 || '').replace(/\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  /* --------------------------------------------------------------------
   * SOAP request and response
   * ------------------------------------------------------------------ */

  function buildEnvelope(reportPath, params) {
    const items = (params || [])
      .map(
        (p) =>
          `          <pub:item><pub:name>${xmlText(p.name)}</pub:name><pub:values><pub:item>${xmlText(p.value)}</pub:item></pub:values></pub:item>`,
      )
      .join('\n');
    return [
      `<soap:Envelope xmlns:soap="${SOAP12_NS}" xmlns:pub="${PUB_NS}">`,
      '  <soap:Header/>',
      '  <soap:Body>',
      '    <pub:runReport>',
      '      <pub:reportRequest>',
      '        <pub:attributeFormat>xml</pub:attributeFormat>',
      '        <pub:byPassCache>true</pub:byPassCache>',
      '        <pub:parameterNameValues>',
      items,
      '        </pub:parameterNameValues>',
      `        <pub:reportAbsolutePath>${xmlText(reportPath)}</pub:reportAbsolutePath>`,
      '        <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>',
      '      </pub:reportRequest>',
      '      <pub:appParams></pub:appParams>',
      '    </pub:runReport>',
      '  </soap:Body>',
      '</soap:Envelope>',
    ].join('\n');
  }

  function httpMessage(status, settings) {
    const where =
      settings.transport === 'direct'
        ? 'the dev proxy (.env)'
        : `the ${settings.endpointId.split('/')[0]} service connection`;
    const known = {
      401: `Fusion rejected the user name or password (HTTP 401). Check the credentials on ${where}.`,
      403: 'This user may not run the report (HTTP 403). It needs BI Publisher access to the report folder.',
      404: 'The BI Publisher web service was not found (HTTP 404). The server URL must end with /xmlpserver/services/ExternalReportWSSService.',
      415: 'BI Publisher refused the content type (HTTP 415). The request must be sent as application/soap+xml.',
      502: 'Fusion did not answer in time (HTTP 502). Try again, or narrow the query.',
      503: 'Fusion is not available right now (HTTP 503). Try again in a minute.',
      504: 'Fusion did not answer in time (HTTP 504). Narrow the query or lower the row limit.',
    };
    return known[status] || `BI Publisher returned HTTP ${status}.`;
  }

  /** Turns a BI Publisher fault into something a person can act on. */
  function cleanFault(text, reportPath) {
    const raw = String(text || '');
    const ora = unique(raw.match(/ORA-\d{5}:[^\n\r<]*/g) || []).map((s) => s.trim());
    const useful = ora.filter((s) => !/^ORA-06512/.test(s));
    if (useful.length) {
      return useful.slice(0, 3).join('\n');
    }
    if (ora.length) {
      return ora.slice(0, 3).join('\n');
    }
    if (/(not\s+exist|not\s+found|cannot\s+be\s+found|no\s+such)/i.test(raw) && /(xdo|report|catalog|path)/i.test(raw)) {
      return `BI Publisher could not find ${reportPath}, or this user cannot see it. Check the report path in Settings and the user's access to that folder.`;
    }
    if (/(InvalidParameters|parameter)/i.test(raw) && /(p_sql|invalid)/i.test(raw)) {
      return `BI Publisher rejected a parameter. Check that the report has the parameters named in Settings. (${raw.slice(0, 240)})`;
    }
    const cleaned = raw
      .replace(/\s+/g, ' ')
      .replace(/(oracle\.[\w.]+Exception:\s*)+/g, '')
      .replace(/PublicReportService::\w+\s+failure due to:\s*/i, '')
      .trim();
    return cleaned.slice(0, 500) || 'BI Publisher returned an error without a message.';
  }

  function faultText(doc) {
    const fault = firstByLocalName(doc, 'Fault');
    if (!fault) {
      return '';
    }
    const reason = firstByLocalName(fault, 'Text') || firstByLocalName(fault, 'faultstring') || fault;
    return reason.textContent || 'SOAP fault';
  }

  /** Reads the HTTP answer: returns the base64 report bytes or throws a readable error. */
  function readSoapAnswer(answer, settings) {
    const text = answer && typeof answer.text === 'string' ? answer.text : '';
    if (!text.trim()) {
      throw new Error(answer && answer.ok === false ? httpMessage(answer.status, settings) : 'BI Publisher sent back an empty answer.');
    }
    let doc;
    try {
      doc = parseXml(text, 'BI Publisher answer');
    } catch (e) {
      if (answer.ok === false) {
        throw new Error(httpMessage(answer.status, settings));
      }
      throw e;
    }
    const fault = faultText(doc);
    if (fault) {
      throw new Error(cleanFault(fault, settings.reportPath));
    }
    const bytes = firstByLocalName(doc, 'reportBytes');
    if (!bytes) {
      if (answer.ok === false) {
        throw new Error(httpMessage(answer.status, settings));
      }
      throw new Error('BI Publisher answered without report data. Check that the report path points to the Fusion SQL report.');
    }
    return bytes.textContent || '';
  }

  function withTimeout(promise, ms, message) {
    let timer = null;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function bodyToText(body) {
    if (body == null) {
      return '';
    }
    if (typeof body === 'string') {
      return body;
    }
    if (typeof window.XMLSerializer === 'function' && body && body.nodeType === 9) {
      return new window.XMLSerializer().serializeToString(body);
    }
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }

  /** Through the VB service connection (VB Studio): VB's proxy adds the credentials. */
  async function sendThroughService(settings, envelope) {
    const timeoutMs = settings.timeoutSec * 1000;
    const timeoutMessage = `Fusion did not answer within ${settings.timeoutSec} seconds. Narrow the query or lower the row limit.`;
    let helper;
    try {
      helper = Rest.get(settings.endpointId);
    } catch (e) {
      throw new Error(
        `The service connection endpoint ${settings.endpointId} is not available in this app (${e && e.message ? e.message : e}). Create it as described in the README, or switch Settings > Connection to "Direct URL".`,
      );
    }
    helper.body(envelope);
    if (typeof helper.initConfiguration === 'function') {
      helper.initConfiguration({ headers: { 'Content-Type': CONTENT_TYPE } });
    }
    if (typeof helper.responseBodyFormat === 'function') {
      helper.responseBodyFormat('text');
    }
    try {
      const result = await withTimeout(helper.fetch(), timeoutMs, timeoutMessage);
      const response = result && result.response;
      return {
        ok: response ? response.ok !== false : true,
        status: response && response.status ? response.status : 200,
        text: bodyToText(result ? result.body : ''),
      };
    } catch (e) {
      if (e && e.message === timeoutMessage) {
        throw e;
      }
      // The REST helper rejects on HTTP errors; the SOAP fault is in the body it carries.
      const response = e && (e.response || (e.payload && e.payload.response));
      const body = e && (e.body !== undefined ? e.body : e.payload && e.payload.body);
      if (response || body) {
        return { ok: false, status: response && response.status ? response.status : 500, text: bodyToText(body) };
      }
      const detail = e && e.message ? e.message : String(e);
      if (/not\s+(found|defined)|unknown|no\s+service/i.test(detail)) {
        throw new Error(
          `The service connection endpoint ${settings.endpointId} was not found. Create it as described in the README, or switch Settings > Connection to "Direct URL".`,
        );
      }
      throw new Error(`The call through the service connection failed: ${detail}`);
    }
  }

  /** Straight to a URL, normally the local dev proxy (npm run proxy). */
  async function sendDirect(settings, envelope) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), settings.timeoutSec * 1000) : null;
    let response;
    try {
      response = await window.fetch(settings.directUrl, {
        method: 'POST',
        headers: { 'Content-Type': CONTENT_TYPE },
        body: envelope,
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      throw new Error(
        e && e.name === 'AbortError'
          ? `Fusion did not answer within ${settings.timeoutSec} seconds. Narrow the query or lower the row limit.`
          : `Could not reach ${settings.directUrl}. Start the dev proxy with "npm run proxy" (it reads your Fusion host and user from .env), or check the URL in Settings.`,
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }

  /* --------------------------------------------------------------------
   * SQL preparation
   * ------------------------------------------------------------------ */

  /** Removes comments and string literals so the checks below only look at SQL. */
  function codeOnly(sql) {
    let out = '';
    let i = 0;
    while (i < sql.length) {
      const c = sql[i];
      const next = sql[i + 1];
      if (c === '-' && next === '-') {
        const end = sql.indexOf('\n', i);
        i = end === -1 ? sql.length : end;
      } else if (c === '/' && next === '*') {
        const end = sql.indexOf('*/', i + 2);
        i = end === -1 ? sql.length : end + 2;
        out += ' ';
      } else if ((c === 'q' || c === 'Q') && next === "'" && i + 2 < sql.length) {
        const open = sql[i + 2];
        const close = { '[': ']', '{': '}', '(': ')', '<': '>' }[open] || open;
        const end = sql.indexOf(`${close}'`, i + 3);
        i = end === -1 ? sql.length : end + 2;
        out += "''";
      } else if (c === "'") {
        let j = i + 1;
        while (j < sql.length) {
          if (sql[j] === "'" && sql[j + 1] === "'") {
            j += 2;
          } else if (sql[j] === "'") {
            break;
          } else {
            j += 1;
          }
        }
        i = j + 1;
        out += "''";
      } else if (c === '"') {
        const end = sql.indexOf('"', i + 1);
        out += '""';
        i = end === -1 ? sql.length : end + 1;
      } else {
        out += c;
        i += 1;
      }
    }
    return out;
  }

  function prepareSql(text, settings) {
    let sql = String(text || '').trim();
    // A trailing semicolon or SQL*Plus "/" line would break the cursor in the report.
    sql = sql.replace(/(?:\s*;|\s*\n\s*\/)+\s*$/, '').trim();
    if (!sql) {
      throw new Error('Type a SELECT statement first.');
    }
    const code = codeOnly(sql).trim();
    if (!/^(select|with|\()/i.test(code)) {
      throw new Error('Only SELECT (or WITH ... SELECT) statements can run through BI Publisher.');
    }
    const bind = code.match(/(^|[^:\w])(:[A-Za-z_][\w$#]*)/);
    if (bind) {
      throw new Error(`Bind variables such as ${bind[2]} can't be passed through the report. Put the value in the SQL instead.`);
    }
    // WITH FUNCTION queries carry PL/SQL, so semicolons inside them are expected.
    if (!/^with\s+(function|procedure)\b/i.test(code) && /;\s*\S/.test(code)) {
      throw new Error('Run one statement at a time. Put the cursor in the statement you want and press Ctrl+Enter, or select it.');
    }

    const maxRows = settings.maxRows;
    const params = [{ name: settings.sqlParam, value: '' }];
    let finalSql = sql;
    if (settings.limitMode === 'wrap') {
      finalSql = `SELECT * FROM (\n${sql}\n) WHERE ROWNUM <= ${maxRows + 1}`;
    } else {
      params.push({ name: settings.maxRowsParam, value: String(maxRows + 1) });
    }
    params[0].value = finalSql;

    const warnings = [];
    const bytes = utf8Length(finalSql);
    if (bytes > LONG_SQL_BYTES) {
      warnings.push(
        `The query is ${bytes.toLocaleString('en-US')} bytes. If BI Publisher rejects it, shorten it: report parameters over ${LONG_SQL_BYTES.toLocaleString('en-US')} bytes can fail.`,
      );
    }
    return { sql: finalSql, params, warnings };
  }

  /* --------------------------------------------------------------------
   * Settings, history and draft (this browser only)
   * ------------------------------------------------------------------ */

  const SETTINGS_KEY = 'fq-settings-v1';
  const HISTORY_KEY = 'fq-history-v1';
  const DRAFT_KEY = 'fq-draft-v1';
  const MAX_HISTORY = 40;

  function defaultSettings() {
    return {
      transport: isLocalHost() ? 'direct' : 'service',
      endpointId: 'fusionBip/runReport',
      directUrl: 'http://localhost:8890/bip',
      reportPath: '/Custom/FusionSQL/FUSION_SQL_RPT.xdo',
      sqlParam: 'p_sql',
      maxRowsParam: 'p_max_rows',
      limitMode: 'report',
      maxRows: 500,
      timeoutSec: 120,
    };
  }

  function normalizeSettings(input) {
    const d = defaultSettings();
    const s = Object.assign({}, d, input || {});
    s.transport = s.transport === 'direct' ? 'direct' : 'service';
    s.limitMode = s.limitMode === 'wrap' ? 'wrap' : 'report';
    ['endpointId', 'directUrl', 'reportPath', 'sqlParam', 'maxRowsParam'].forEach((k) => {
      s[k] = typeof s[k] === 'string' && s[k].trim() ? s[k].trim() : d[k];
    });
    s.maxRows = clampInt(s.maxRows, 1, MAX_ROWS_CAP, d.maxRows);
    s.timeoutSec = clampInt(s.timeoutSec, 10, 600, d.timeoutSec);
    return s;
  }

  function readSettings() {
    return normalizeSettings(storageGet(SETTINGS_KEY, {}));
  }

  function connectionLabel(s) {
    const where = s.transport === 'direct' ? `Direct: ${s.directUrl}` : `Service connection: ${s.endpointId}`;
    return `${where} · ${s.reportPath}`;
  }

  /* --------------------------------------------------------------------
   * Table browser SQL (data dictionary through the same report)
   * ------------------------------------------------------------------ */

  function identifier(value, what) {
    const id = String(value || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(id)) {
      throw new Error(`"${value}" is not a valid ${what} name.`);
    }
    return id;
  }

  function tablesSql(term) {
    const t = String(term || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_$#%]/g, '');
    if (t.replace(/%/g, '').length < 2) {
      throw new Error('Type at least two letters of a table or view name.');
    }
    return [
      'SELECT object_name, object_type, owner',
      '  FROM all_objects',
      " WHERE object_type IN ('TABLE', 'VIEW')",
      `   AND object_name LIKE '%${t}%'`,
      ` ORDER BY CASE WHEN object_name LIKE '${t}%' THEN 0 ELSE 1 END, object_name, owner`,
    ].join('\n');
  }

  function columnsSql(owner, name) {
    return [
      'SELECT column_name, data_type, data_length, data_precision, data_scale, nullable',
      '  FROM all_tab_columns',
      ` WHERE owner = '${identifier(owner, 'owner')}'`,
      `   AND table_name = '${identifier(name, 'table')}'`,
      ' ORDER BY column_id',
    ].join('\n');
  }

  /* --------------------------------------------------------------------
   * Claude: write a query from a question, or fix one from its error.
   * The key stays in this browser (localStorage when "Remember" is on, otherwise
   * memory). For production, call Claude from a server-side proxy instead.
   * ------------------------------------------------------------------ */

  const CL_URL = 'https://api.anthropic.com/v1/messages';
  const CL_VERSION = '2023-06-01';
  const CL_KEY = 'fq-claude-v1';
  const CL_MODELS = [
    { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (fast, recommended)' },
    { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
    { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' },
  ];
  const CL_DEFAULTS = { apiKey: '', model: 'claude-sonnet-5-5', remember: true };
  let clSessionKey = '';

  function clRead() {
    const s = Object.assign({}, CL_DEFAULTS, storageGet(CL_KEY, {}));
    if (!s.apiKey && clSessionKey) {
      s.apiKey = clSessionKey;
    }
    if (!CL_MODELS.some((m) => m.value === s.model)) {
      s.model = CL_DEFAULTS.model;
    }
    return s;
  }

  function clWrite(s) {
    const remember = s.remember !== false;
    clSessionKey = remember ? '' : s.apiKey || '';
    const ok = storageSet(CL_KEY, { model: s.model, remember, apiKey: remember ? s.apiKey || '' : '' });
    if (!ok) {
      clSessionKey = s.apiKey || '';
    }
  }

  function clSystemPrompt() {
    return [
      'You write Oracle SQL for Oracle Fusion Cloud Applications (ERP Financials, Procurement, Supply Chain, HCM).',
      'The query runs inside a BI Publisher data model on the ApplicationDB_FSCM data source, through DBMS_XMLGEN, so:',
      '- Return exactly one SELECT (or WITH ... SELECT) statement. No DML, no PL/SQL blocks, no bind variables (:x), no trailing semicolon.',
      '- Do not add a row limit; the app applies one. Add ORDER BY when the order matters.',
      '- Give every expression a readable column alias in UPPER_SNAKE_CASE.',
      "- Use Fusion's real tables and views (for example GL_JE_HEADERS, GL_JE_LINES, GL_CODE_COMBINATIONS, GL_PERIOD_STATUSES, AP_INVOICES_ALL, AP_SUPPLIERS, POZ_SUPPLIERS_V, PO_HEADERS_ALL, PO_LINES_ALL, RA_CUSTOMER_TRX_ALL, HZ_PARTIES, HZ_CUST_ACCOUNTS, EGP_SYSTEM_ITEMS_B, INV_ONHAND_QUANTITIES_DETAIL, INV_MATERIAL_TXNS, DOO_HEADERS_ALL, DOO_LINES_ALL, WSH_DELIVERY_DETAILS, FA_ADDITIONS_B, FA_BOOKS, HR_ALL_ORGANIZATION_UNITS_F, PER_ALL_PEOPLE_F, FND_LOOKUP_VALUES).",
      "- For translated _TL tables filter LANGUAGE = USERENV('LANG'). For date-effective _F tables filter TRUNC(SYSDATE) BETWEEN EFFECTIVE_START_DATE AND EFFECTIVE_END_DATE.",
      '- When the user lists table columns, use only those columns for that table. If you are unsure a column exists, say so in a -- comment at the top of the query.',
      'Answer with one ```sql fenced block, then at most two short sentences about assumptions. Nothing else.',
    ].join('\n');
  }

  async function clCall(apiKey, body) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 120000) : null;
    let response;
    try {
      response = await window.fetch(CL_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': CL_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      throw new Error(
        e && e.name === 'AbortError'
          ? 'Claude took more than 2 minutes to answer. Try again, or pick a faster model in Settings.'
          : 'Could not reach api.anthropic.com from this browser. Check the connection, and whether a proxy or the page security policy blocks it.',
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const detail = data && data.error && data.error.message ? data.error.message : `HTTP ${response.status}`;
      const hint =
        {
          401: 'The Claude API key was rejected. Check it in Settings.',
          404: 'That model is not available to this key. Pick another model in Settings.',
          429: 'Rate or spend limit reached. Wait a moment and try again.',
          529: 'Claude is busy right now. Try again in a minute.',
        }[response.status] || 'The Claude API returned an error.';
      throw new Error(`${hint} (${response.status}: ${detail})`);
    }
    return data || {};
  }

  function extractSql(text) {
    const fenced = String(text || '').match(/```(?:sql)?\s*\n([\s\S]*?)```/i);
    const sql = fenced ? fenced[1].trim() : '';
    const note = fenced ? String(text).replace(fenced[0], '').trim() : String(text || '').trim();
    if (sql) {
      return { sql: sql.replace(/;\s*$/, ''), note: note.slice(0, 400) };
    }
    if (/^\s*(select|with)\b/i.test(note)) {
      return { sql: note.replace(/;\s*$/, ''), note: '' };
    }
    return { sql: '', note: note.slice(0, 400) };
  }

  function readHistory() {
    const list = storageGet(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function claudeStatus() {
    const s = clRead();
    const m = CL_MODELS.find((x) => x.value === s.model);
    return {
      hasKey: Boolean(s.apiKey),
      keyHint: s.apiKey ? `…${s.apiKey.slice(-4)}` : '',
      model: s.model,
      modelLabel: m ? m.label.replace(/ \(.*\)$/, '') : s.model,
      remember: s.remember !== false,
    };
  }

  /* --------------------------------------------------------------------
   * Application module
   * ------------------------------------------------------------------ */

  class AppModule {
    /* ---------- Settings ---------- */

    settings() {
      return readSettings();
    }

    settingsForm() {
      const s = readSettings();
      return Object.assign({}, s, { maxRows: s.maxRows, timeoutSec: s.timeoutSec });
    }

    saveSettings(form) {
      const s = normalizeSettings(form);
      storageSet(SETTINGS_KEY, s);
      return s;
    }

    resetSettings() {
      storageRemove(SETTINGS_KEY);
      return readSettings();
    }

    connectionLabel(settings) {
      return connectionLabel(settings || readSettings());
    }

    setMaxRows(value) {
      const s = readSettings();
      s.maxRows = clampInt(value, 1, MAX_ROWS_CAP, s.maxRows);
      storageSet(SETTINGS_KEY, s);
      return s.maxRows;
    }

    maxRowsCap() {
      return MAX_ROWS_CAP;
    }

    /* ---------- Running SQL ---------- */

    /**
     * Runs one SELECT on Fusion through the BI Publisher report.
     * @returns {Promise<{columns:Array, rows:Array, truncated:boolean, ms:number, maxRows:number, warnings:string[], sentSql:string}>}
     */
    async runSql(text, overrides) {
      const settings = normalizeSettings(Object.assign(readSettings(), overrides || {}));
      const prepared = prepareSql(text, settings);
      const envelope = buildEnvelope(settings.reportPath, prepared.params);
      const started = Date.now();
      const answer =
        settings.transport === 'direct'
          ? await sendDirect(settings, envelope)
          : await sendThroughService(settings, envelope);
      const base64 = readSoapAnswer(answer, settings);
      const xml = base64 ? decodeBase64Utf8(base64) : '';
      const parsed = xml
        ? parseReportXml(xml, [settings.sqlParam, settings.maxRowsParam])
        : { columns: [], rows: [], shape: 'empty' };
      const truncated = parsed.rows.length > settings.maxRows;
      const rows = truncated ? parsed.rows.slice(0, settings.maxRows) : parsed.rows;
      return {
        columns: parsed.columns,
        rows,
        truncated,
        ms: Date.now() - started,
        maxRows: settings.maxRows,
        warnings: prepared.warnings,
        sentSql: prepared.sql,
        shape: parsed.shape,
      };
    }

    /** Pieces of the engine, for the tests in tools/test and for reuse in other pages. */
    engine() {
      return {
        buildEnvelope,
        prepareSql,
        readSoapAnswer,
        parseReportXml,
        decodeBase64Utf8,
        decodeColumnName,
        cleanFault,
        normalizeSettings,
        tablesSql,
        columnsSql,
        extractSql,
        codeOnly,
      };
    }

    tablesSql(term) {
      return tablesSql(term);
    }

    columnsSql(owner, name) {
      return columnsSql(owner, name);
    }

    /* ---------- History and draft ---------- */

    history() {
      return readHistory();
    }

    addHistory(entry) {
      const sql = String(entry.sql || '').trim();
      if (!sql) {
        return readHistory();
      }
      const list = readHistory().filter((h) => h.sql !== sql);
      list.unshift({
        id: `h${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
        sql,
        at: new Date().toISOString(),
        ok: entry.ok === true,
        rows: entry.ok ? entry.rows || 0 : 0,
        ms: entry.ms || 0,
        error: entry.ok ? '' : String(entry.error || '').slice(0, 200),
      });
      const trimmed = list.slice(0, MAX_HISTORY);
      storageSet(HISTORY_KEY, trimmed);
      return trimmed;
    }

    clearHistory() {
      storageRemove(HISTORY_KEY);
      return [];
    }

    draft() {
      const d = storageGet(DRAFT_KEY, '');
      return typeof d === 'string' ? d : '';
    }

    saveDraft(sql) {
      storageSet(DRAFT_KEY, String(sql || ''));
    }

    /* ---------- Claude ---------- */

    claudeSettings() {
      return claudeStatus();
    }

    claudeForm() {
      const s = clRead();
      return { apiKey: '', model: s.model, remember: s.remember !== false };
    }

    claudeModels() {
      return clone(CL_MODELS);
    }

    saveClaude(form) {
      const current = clRead();
      const f = form || {};
      clWrite({
        apiKey: typeof f.apiKey === 'string' && f.apiKey.trim() ? f.apiKey.trim() : current.apiKey,
        model: CL_MODELS.some((m) => m.value === f.model) ? f.model : current.model,
        remember: f.remember !== false,
      });
      return claudeStatus();
    }

    removeClaudeKey() {
      clSessionKey = '';
      const s = clRead();
      clWrite({ apiKey: '', model: s.model, remember: s.remember });
      return claudeStatus();
    }

    /**
     * Asks Claude for a query.
     * @param {{mode:'write'|'fix', question?:string, sql?:string, error?:string, tables?:Array}} request
     * @returns {Promise<{sql:string, note:string}>}
     */
    async askClaude(request) {
      const s = clRead();
      if (!s.apiKey) {
        throw new Error('Add a Claude API key in Settings first.');
      }
      const r = request || {};
      const parts = [];
      (r.tables || []).slice(0, 4).forEach((t) => {
        const cols = (t.columns || []).slice(0, 80).map((c) => `${c.name} ${c.type}`).join(', ');
        parts.push(`Columns of ${t.name}: ${cols}`);
      });
      if (r.mode === 'fix') {
        parts.push(`This query failed:\n\`\`\`sql\n${r.sql || ''}\n\`\`\`\nError from Oracle / BI Publisher:\n${r.error || ''}`);
        parts.push('Return the corrected full query.');
      } else {
        if (r.sql && r.sql.trim()) {
          parts.push(`The query in the editor now (use it as a starting point if it helps):\n\`\`\`sql\n${r.sql}\n\`\`\``);
        }
        parts.push(`Write a query for this: ${r.question || ''}`);
      }
      const data = await clCall(s.apiKey, {
        model: s.model,
        max_tokens: 1500,
        system: clSystemPrompt(),
        messages: [{ role: 'user', content: parts.join('\n\n') }],
      });
      const text = (data.content || [])
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const out = extractSql(text);
      if (!out.sql) {
        throw new Error(out.note || 'Claude did not return a query. Rephrase the request and try again.');
      }
      return out;
    }

    async testClaude(form) {
      const current = clRead();
      const f = form || {};
      const key = typeof f.apiKey === 'string' && f.apiKey.trim() ? f.apiKey.trim() : current.apiKey;
      if (!key) {
        return { ok: false, message: 'Paste a Claude API key first.' };
      }
      const model = CL_MODELS.some((m) => m.value === f.model) ? f.model : current.model;
      try {
        await clCall(key, { model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] });
        return { ok: true, message: 'Claude answered. The key works.' };
      } catch (e) {
        return { ok: false, message: e.message };
      }
    }

    /* ---------- Messages ---------- */

    message(severity, summary, detail) {
      return [
        {
          severity: severity || 'confirmation',
          summary: summary || '',
          detail: detail || '',
          autoTimeout: severity === 'error' ? 0 : 5000,
          closeAffordance: 'defaults',
        },
      ];
    }
  }

  return AppModule;
});
