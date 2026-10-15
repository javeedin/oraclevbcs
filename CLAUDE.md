# CLAUDE.md: working on Fusion SQL

This branch is an **Oracle Visual Builder (VB) visual application** with one page: a SQL editor
that runs SELECTs on Oracle Fusion through a BI Publisher `runReport` SOAP call. VB reads the
JSON/HTML/JS files at runtime; there is no bundler and no JSX. It uses Oracle JET core
components only (no `oj-sp` Redwood templates), so nothing comes from the Component Exchange.

## Layout

```
visual-application.json            VB 25.10 runtime, JET 18.1.4 - do not hand-edit versions
package.json, Gruntfile.js         grunt-vb-build 2510 tooling, Node 20. npm run build / serve / proxy / test / lint
bip/FUSION_SQL_DM.sql              BI Publisher data model SQL (WITH FUNCTION + DBMS_XMLGEN), Non-standard SQL
tools/bip-dev-proxy.js             local proxy for the preview: adds Fusion credentials from .env
tools/test/run-tests.js            Node tests: engine, page module, chains (mock VB context), proxy
webApps/fusionsql/
  app-flow.js                      define(['vb/helpers/rest']) - SOAP engine, settings, history, Claude
  app-flow.json                    defaultPage fusion-sql, CSS import
  pages/fusion-sql-page.*          the page (json/html/js) and fusion-sql-page-chains/
  resources/css/app.css            layout only: fq- prefix, --oj-core-* variables
```

## How a query runs

`runChain` → `$page.functions.currentStatement()` (selection, else statement at the cursor)
→ `$application.functions.runSql(sql, overrides?)`:
`prepareSql` (checks, row limit) → `buildEnvelope` → `sendThroughService` (VB service
connection `fusionBip/runReport`, `Rest.get(...).body().fetch()`) or `sendDirect` (fetch to the
dev proxy) → `readSoapAnswer` (faults, HTTP errors, `reportBytes`) → `decodeBase64Utf8` →
`parseReportXml` (ROWSET text or elements; else the biggest repeating group) →
`{ columns: [{key, name, numeric}], rows: [{__n, c0, c1, ...}], truncated, ms, warnings }`.

Rows use generated keys `c0..cn` because column names can be anything; `columns[i].name` is the
display name. The grid's ADP is a plain `ojs/ojarraydataprovider` made in the page module and
held in an `any` variable, because the columns change with every query.

## Rules

1. **Every page is a triplet** `<name>-page.json/.html/.js`, plus `<name>-page-chains/`.
2. **Action chains are JS classes** (`codeChainsEnabled` is on). The class name equals the file
   name. Use `async run(context, { param } = {})` so a call without parameters is safe.
3. **Wiring:** `on-oj-action` (JET buttons), `on-click` (plain buttons), `on-keydown`,
   `on-value-changed`, `on-raw-value-changed`, `on-oj-value-action` (oj-input-search Enter).
   Every listener must exist in the page JSON `eventListeners`; inside `oj-bind-for-each` use
   `$current.data`.
4. **Binding:** `[[ ]]` one-way, `{{ }}` two-way. Keep expressions simple (no `String()`, no
   array literals): put logic in page functions (`$functions.x()` in HTML, `$page.functions.x()`
   in chains). App functions are `$application.functions.x()`.
5. **Every component used in HTML is imported** in the page JSON `imports.components`.
6. **Don't rely on `this`** inside page or app module methods; use module-level helpers.
7. **The editor value may be uncommitted** when Ctrl+Enter or a button fires: read it with
   `currentStatement()` / `editorText()` (the textarea itself), and JET fields with `rawText(id)`.
8. **Never put Fusion credentials in the page.** They live on the VB service connection (VB
   Studio) or in `.env` for the dev proxy. The Claude key is the only secret in the browser, and
   only for demos.
9. **Only SELECT/WITH.** Keep the checks in `prepareSql`; the report is read-only by design.
10. After any change run `npm test` and `npm run lint` (and `npm run build` where Oracle's CDN
    is reachable) and fix errors before committing.
