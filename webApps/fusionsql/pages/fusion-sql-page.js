define(['ojs/ojarraydataprovider'], (ArrayDataProvider) => {
  'use strict';

  /* Page module: $functions.<name>() in the page HTML, $page.functions.<name>() in chains.
   * Everything here is either pure (statement picking, formatting, CSV) or a small DOM helper
   * for the editor, dialogs and the clipboard. */

  const STARTERS = [
    {
      id: 'check',
      label: 'Connection check',
      hint: 'Who the report runs as, and the server time',
      sql: [
        'SELECT USER AS db_user,',
        "       SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name,",
        "       TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS server_time",
        '  FROM dual',
      ].join('\n'),
    },
    {
      id: 'periods',
      label: 'GL periods',
      hint: 'General Ledger period status by ledger',
      sql: [
        'SELECT gl.name AS ledger_name,',
        '       ps.period_name,',
        '       ps.closing_status,',
        '       ps.start_date,',
        '       ps.end_date',
        '  FROM gl_period_statuses ps',
        '  JOIN gl_ledgers gl ON gl.ledger_id = ps.ledger_id',
        ' WHERE ps.application_id = 101',
        "   AND ps.adjustment_period_flag = 'N'",
        ' ORDER BY ps.start_date DESC, gl.name',
      ].join('\n'),
    },
    {
      id: 'items',
      label: 'Items',
      hint: 'Recently changed items with their description',
      sql: [
        'SELECT esi.item_number,',
        '       esit.description,',
        '       esi.primary_uom_code,',
        '       esi.inventory_item_status_code,',
        '       iop.organization_code,',
        '       esi.last_update_date',
        '  FROM egp_system_items_b esi',
        '  JOIN egp_system_items_tl esit',
        '    ON esit.inventory_item_id = esi.inventory_item_id',
        '   AND esit.organization_id = esi.organization_id',
        "   AND esit.language = USERENV('LANG')",
        '  JOIN inv_org_parameters iop ON iop.organization_id = esi.organization_id',
        ' ORDER BY esi.last_update_date DESC',
      ].join('\n'),
    },
    {
      id: 'onhand',
      label: 'On hand',
      hint: 'On-hand quantity by organization, item and subinventory',
      sql: [
        'SELECT iop.organization_code,',
        '       esi.item_number,',
        '       oh.subinventory_code,',
        '       SUM(oh.transaction_quantity) AS on_hand_qty',
        '  FROM inv_onhand_quantities_detail oh',
        '  JOIN egp_system_items_b esi',
        '    ON esi.inventory_item_id = oh.inventory_item_id',
        '   AND esi.organization_id = oh.organization_id',
        '  JOIN inv_org_parameters iop ON iop.organization_id = oh.organization_id',
        ' GROUP BY iop.organization_code, esi.item_number, oh.subinventory_code',
        ' ORDER BY on_hand_qty DESC',
      ].join('\n'),
    },
    {
      id: 'ap',
      label: 'Open AP invoices',
      hint: 'Payables invoices with an amount still remaining',
      sql: [
        'SELECT aia.invoice_num,',
        '       sup.vendor_name,',
        '       aia.invoice_date,',
        '       aia.invoice_currency_code,',
        '       aia.invoice_amount,',
        '       SUM(aps.amount_remaining) AS amount_remaining',
        '  FROM ap_invoices_all aia',
        '  JOIN poz_suppliers_v sup ON sup.vendor_id = aia.vendor_id',
        '  JOIN ap_payment_schedules_all aps ON aps.invoice_id = aia.invoice_id',
        ' GROUP BY aia.invoice_num, sup.vendor_name, aia.invoice_date, aia.invoice_currency_code, aia.invoice_amount',
        'HAVING SUM(aps.amount_remaining) <> 0',
        ' ORDER BY aia.invoice_date DESC',
      ].join('\n'),
    },
    {
      id: 'shipping',
      label: 'Pending shipments',
      hint: 'Delivery details not yet shipped',
      sql: [
        'SELECT iop.organization_code,',
        '       wdd.source_header_number AS order_number,',
        '       wdd.source_line_number AS line_number,',
        '       wdd.released_status,',
        '       wdd.requested_quantity,',
        '       wdd.creation_date',
        '  FROM wsh_delivery_details wdd',
        '  JOIN inv_org_parameters iop ON iop.organization_id = wdd.organization_id',
        " WHERE wdd.released_status IN ('R', 'S', 'Y')",
        ' ORDER BY wdd.creation_date DESC',
      ].join('\n'),
    },
    {
      id: 'columns',
      label: 'Columns of a table',
      hint: 'The data dictionary works through the same report',
      sql: [
        'SELECT column_name, data_type, data_length, nullable',
        '  FROM all_tab_columns',
        " WHERE table_name = 'PO_HEADERS_ALL'",
        ' ORDER BY column_id',
      ].join('\n'),
    },
  ];

  /* ---------- Statement picking (what Ctrl+Enter runs) ---------- */

  function lineIsOnlySlash(text, at) {
    const lineStart = text.lastIndexOf('\n', at - 1) + 1;
    let lineEnd = text.indexOf('\n', at);
    if (lineEnd === -1) {
      lineEnd = text.length;
    }
    return text.slice(lineStart, lineEnd).trim() === '/';
  }

  /** Statement ranges split on ";" and on lines holding only "/", ignoring quotes and comments. */
  function splitStatements(text) {
    const parts = [];
    let segStart = 0;
    let i = 0;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      const d = text[i + 1];
      if (c === '-' && d === '-') {
        const e = text.indexOf('\n', i);
        i = e === -1 ? n : e;
      } else if (c === '/' && d === '*') {
        const e = text.indexOf('*/', i + 2);
        i = e === -1 ? n : e + 2;
      } else if ((c === 'q' || c === 'Q') && d === "'" && i + 2 < n && !/[\w$#]/.test(text[i - 1] || '')) {
        const open = text[i + 2];
        const close = { '[': ']', '{': '}', '(': ')', '<': '>' }[open] || open;
        const e = text.indexOf(`${close}'`, i + 3);
        i = e === -1 ? n : e + 2;
      } else if (c === "'") {
        let j = i + 1;
        while (j < n) {
          if (text[j] === "'" && text[j + 1] === "'") {
            j += 2;
          } else if (text[j] === "'") {
            break;
          } else {
            j += 1;
          }
        }
        i = j + 1;
      } else if (c === '"') {
        const e = text.indexOf('"', i + 1);
        i = e === -1 ? n : e + 1;
      } else if (c === ';' || (c === '/' && lineIsOnlySlash(text, i))) {
        parts.push({ start: segStart, end: i });
        segStart = i + 1;
        i += 1;
      } else {
        i += 1;
      }
    }
    parts.push({ start: segStart, end: n });
    return parts;
  }

  /**
   * What to run: the selection if there is one; otherwise the statement the cursor is in
   * (statements end with ";" or a "/" line); otherwise everything.
   */
  function pickStatement(text, start, end) {
    const all = String(text || '');
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      const selected = all.slice(start, end).trim();
      if (selected) {
        return { sql: selected, scope: 'selection' };
      }
    }
    if (/^\s*with\s+(function|procedure)\b/i.test(all)) {
      return { sql: all.trim(), scope: 'all' };
    }
    const parts = splitStatements(all).filter((p) => all.slice(p.start, p.end).trim());
    if (parts.length <= 1) {
      return { sql: parts.length ? all.slice(parts[0].start, parts[0].end).trim() : '', scope: 'all' };
    }
    const pos = typeof start === 'number' ? start : 0;
    let chosen = parts.find((p) => pos >= p.start && pos <= p.end + 1);
    if (!chosen) {
      const before = parts.filter((p) => p.start <= pos);
      chosen = before.length ? before[before.length - 1] : parts[0];
    }
    return { sql: all.slice(chosen.start, chosen.end).trim(), scope: 'statement' };
  }

  /* ---------- Grid ---------- */

  const collator =
    typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;

  function nullsLast(a, b) {
    const an = a === null || a === undefined || a === '';
    const bn = b === null || b === undefined || b === '';
    if (an && bn) {
      return 0;
    }
    return an ? 1 : bn ? -1 : null;
  }

  function compareNumbers(a, b) {
    const n = nullsLast(a, b);
    return n !== null ? n : Number(a) - Number(b);
  }

  function compareText(a, b) {
    const n = nullsLast(a, b);
    if (n !== null) {
      return n;
    }
    return collator ? collator.compare(String(a), String(b)) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }

  function seconds(ms) {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  }

  function plural(n, word) {
    return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
  }

  function cellText(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function rowsAsObjects(result) {
    return ((result && result.rows) || []).map((r) => {
      const o = {};
      ((result && result.columns) || []).forEach((c) => {
        o[String(c.name).toUpperCase()] = r[c.key];
      });
      return o;
    });
  }

  function editorTextarea() {
    const host = document.getElementById('sqlEditor');
    return host ? host.querySelector('textarea') : null;
  }

  class PageModule {
    starters() {
      return STARTERS.map((s) => ({ id: s.id, label: s.label, hint: s.hint }));
    }

    starterSql(id) {
      const s = STARTERS.find((x) => x.id === id);
      return s ? s.sql : '';
    }

    pickStatement(text, start, end) {
      return pickStatement(text, start, end);
    }

    /** The statement to run, read straight from the editor so uncommitted typing counts. */
    currentStatement(fallback) {
      const ta = editorTextarea();
      if (!ta) {
        return pickStatement(fallback || '');
      }
      return pickStatement(ta.value, ta.selectionStart, ta.selectionEnd);
    }

    editorText(fallback) {
      const ta = editorTextarea();
      return ta ? ta.value : fallback || '';
    }

    /** Text of the editor with a snippet typed in at the cursor (or replacing the selection). */
    insertAtCursor(snippet, fallback) {
      const ta = editorTextarea();
      const text = ta ? ta.value : fallback || '';
      const start = ta && typeof ta.selectionStart === 'number' ? ta.selectionStart : text.length;
      const end = ta && typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
      return { text: text.slice(0, start) + snippet + text.slice(end), caret: start + snippet.length };
    }

    focusEditor(caret) {
      setTimeout(() => {
        const ta = editorTextarea();
        if (!ta) {
          return;
        }
        ta.focus();
        if (typeof caret === 'number' && typeof ta.setSelectionRange === 'function') {
          ta.setSelectionRange(caret, caret);
        }
      }, 80);
    }

    /** Replaces one statement inside the editor text (used when Claude fixes a statement). */
    replaceStatement(text, oldSql, newSql) {
      const all = String(text || '');
      const at = oldSql ? all.indexOf(oldSql) : -1;
      return at === -1 ? newSql : all.slice(0, at) + newSql + all.slice(at + oldSql.length);
    }

    tableColumns(cols) {
      const list = [
        {
          headerText: '#',
          field: '__n',
          className: 'fq-rownum',
          headerClassName: 'fq-rownum',
          sortable: 'disabled',
          resizable: 'disabled',
          frozenEdge: 'start',
        },
      ];
      (cols || []).forEach((c) => {
        list.push({
          headerText: c.name,
          field: c.key,
          sortable: 'enabled',
          resizable: 'enabled',
          className: c.numeric ? 'oj-helper-text-align-end fq-num' : '',
          headerClassName: c.numeric ? 'oj-helper-text-align-end' : '',
        });
      });
      return list;
    }

    makeADP(rows, cols) {
      const comparators = new Map();
      (cols || []).forEach((c) => comparators.set(c.key, c.numeric ? compareNumbers : compareText));
      return new ArrayDataProvider(rows || [], { keyAttributes: '__n', sortComparators: { comparators } });
    }

    filterRows(rows, cols, text) {
      const needle = String(text || '').trim().toLowerCase();
      if (!needle) {
        return rows || [];
      }
      const keys = (cols || []).map((c) => c.key);
      return (rows || []).filter((r) => keys.some((k) => cellText(r[k]).toLowerCase().indexOf(needle) !== -1));
    }

    resultInfo(result, scope, shown) {
      const rows = result.rows.length;
      const parts = [plural(rows, 'row'), seconds(result.ms)];
      if (result.truncated) {
        parts.push(`stopped at ${result.maxRows.toLocaleString('en-US')}; raise Max rows for more`);
      }
      if (scope === 'selection') {
        parts.push('ran the selection');
      } else if (scope === 'statement') {
        parts.push('ran the statement at the cursor');
      }
      if (typeof shown === 'number' && shown !== rows) {
        parts.push(`${shown.toLocaleString('en-US')} match the filter`);
      }
      return {
        ran: true,
        rows,
        shown: typeof shown === 'number' ? shown : rows,
        ms: result.ms,
        truncated: result.truncated === true,
        maxRows: result.maxRows,
        scope: scope || 'all',
        summary: parts.join(' · '),
        warnings: result.warnings || [],
      };
    }

    withFilterInfo(info, shown) {
      const base = String(info.summary || '').replace(/ · [\d,]+ match the filter$/, '');
      return Object.assign({}, info, {
        shown,
        summary: shown !== info.rows ? `${base} · ${shown.toLocaleString('en-US')} match the filter` : base,
      });
    }

    cellTitle(value) {
      const text = cellText(value);
      return text.length > 60 ? text : '';
    }

    /* ---------- Data dictionary ---------- */

    rowsAsObjects(result) {
      return rowsAsObjects(result);
    }

    tableList(result) {
      return rowsAsObjects(result).map((r, i) => ({
        id: `${r.OWNER}.${r.OBJECT_NAME}.${i}`,
        name: r.OBJECT_NAME || '',
        type: r.OBJECT_TYPE ? `${r.OBJECT_TYPE.charAt(0)}${r.OBJECT_TYPE.slice(1).toLowerCase()}` : '',
        owner: r.OWNER || '',
      }));
    }

    describedFrom(owner, name, result) {
      const columns = rowsAsObjects(result).map((r) => {
        const t = r.DATA_TYPE || '';
        let type = t;
        if (t === 'NUMBER' && r.DATA_PRECISION) {
          type = `NUMBER(${r.DATA_PRECISION}${r.DATA_SCALE && r.DATA_SCALE !== '0' ? `,${r.DATA_SCALE}` : ''})`;
        } else if (/CHAR|RAW/.test(t) && r.DATA_LENGTH) {
          type = `${t}(${r.DATA_LENGTH})`;
        }
        return { id: r.COLUMN_NAME, name: r.COLUMN_NAME || '', type, nullable: r.NULLABLE !== 'N' };
      });
      return {
        owner,
        name,
        columns,
        summary: `${owner} · ${plural(columns.length, 'column')}`,
      };
    }

    describedColumns(described) {
      return described && Array.isArray(described.columns) ? described.columns : [];
    }

    selectFor(described) {
      const target = described.owner && described.owner !== 'FUSION' ? `${described.owner}.${described.name}` : described.name;
      const cols = described.columns || [];
      if (!cols.length || cols.length > 40) {
        return `SELECT *\n  FROM ${target}`;
      }
      return `SELECT ${cols.map((c) => c.name).join(',\n       ')}\n  FROM ${target}`;
    }

    /** What Claude gets about the tables you opened: the last four. */
    rememberTable(list, described) {
      const next = (list || []).filter((t) => t.name !== described.name);
      next.unshift({ name: described.name, columns: described.columns.map((c) => ({ name: c.name, type: c.type })) });
      return next.slice(0, 4);
    }

    /* ---------- History ---------- */

    preview(sql) {
      const flat = String(sql || '').replace(/\s+/g, ' ').trim();
      return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
    }

    historyMeta(entry) {
      const at = new Date(entry.at);
      const mins = Math.round((Date.now() - at.getTime()) / 60000);
      let when;
      if (!Number.isFinite(mins)) {
        when = '';
      } else if (mins < 1) {
        when = 'just now';
      } else if (mins < 60) {
        when = `${mins} min ago`;
      } else if (mins < 24 * 60) {
        when = `${Math.round(mins / 60)} h ago`;
      } else {
        when = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      const what = entry.ok ? `${plural(entry.rows || 0, 'row')} · ${seconds(entry.ms || 0)}` : 'failed';
      return when ? `${when} · ${what}` : what;
    }

    /* ---------- Export ---------- */

    toDelimited(cols, rows, separator) {
      const sep = separator || ',';
      const csv = sep === ',';
      const esc = (value) => {
        const text = cellText(value);
        if (!csv) {
          return text.replace(/[\t\r\n]+/g, ' ');
        }
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = [(cols || []).map((c) => esc(c.name)).join(sep)];
      (rows || []).forEach((r) => lines.push((cols || []).map((c) => esc(r[c.key])).join(sep)));
      return lines.join('\r\n');
    }

    fileName(ext) {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `fusion-sql-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
    }

    download(name, text, mime) {
      // The byte order mark makes Excel read UTF-8 (Arabic, accented names) correctly.
      const blob = new Blob(['﻿', text], { type: mime || 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // fall back below
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }

    /* ---------- DOM helpers ---------- */

    /** What is typed in a JET field right now, even before it is committed. */
    rawText(id) {
      const field = document.getElementById(id);
      return field && typeof field.rawValue === 'string' ? field.rawValue : '';
    }

    openDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog && typeof dialog.open === 'function') {
        dialog.open();
      }
    }

    closeDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    }
  }

  return PageModule;
});
