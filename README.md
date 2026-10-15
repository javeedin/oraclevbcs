# Fusion SQL: run SQL on Oracle Fusion from Visual Builder, through BI Publisher

A Visual Builder app with a SQL editor that runs `SELECT` statements on Oracle Fusion and
shows the rows in a grid. It works the same way as the Fusion SQL module in the WMS app: one
BI Publisher report takes the SQL as a parameter, the app calls **`runReport`** over SOAP,
decodes the `reportBytes`, and reads the rows out of the report XML.

```
 VB page ──SOAP 1.2 runReport──▶ ExternalReportWSSService ──▶ FUSION_SQL_RPT.xdo
   ▲        (p_sql, p_max_rows)                                 │  data model: OPEN cursor FOR p_sql,
   │                                                            │  DBMS_XMLGEN → ROWSET XML
   └──── grid ◀── parse ROWSET ◀── UTF-8 ◀── base64 reportBytes ◀┘
```

| Area | What it does |
|---|---|
| Editor | **Ctrl+Enter** runs the statement the cursor is in (statements end with `;` or a `/` line), or just what you select. **Run** does the same. The editor text is kept between visits. |
| Results | Grid with sorting (numbers sort as numbers), a filter over the rows already fetched, **Copy** (tab-separated, pastes into Excel) and **CSV** (UTF-8 with BOM, so Arabic and accented names open correctly in Excel). NULLs show as *null*. |
| Max rows | The row limit goes to the report (`p_max_rows`), so Fusion stops early. The app asks for one row more, to tell you when there are more rows on Fusion. |
| History | The last 40 queries in this browser, with rows, time and failures. Load one into the editor or run it again. |
| Tables | Find tables and views (`ALL_OBJECTS`), open one to see its columns (`ALL_TAB_COLUMNS`), click a column to type it at the cursor, or **Write a SELECT** with all its columns. |
| Claude (optional) | **Write SQL** from a sentence (*open AP invoices over 10,000 AED by supplier*), or **Fix with Claude** when a query fails: Claude gets the statement, the ORA error and the columns of the tables you opened. It only changes the editor; you run the query. |
| Settings | How to reach Fusion, the report path, parameter names, row-limit method, timeout, **Test connection**, and the Claude key. |

The SQL is checked before it goes out: one statement, `SELECT` or `WITH` only, no bind
variables (`:x`), trailing `;` and `/` removed.

---

## 1. Create the report in Fusion (once per pod)

The data model SQL is in [`bip/FUSION_SQL_DM.sql`](bip/FUSION_SQL_DM.sql).

1. In Fusion, open **Tools > Reports and Analytics > Browse Catalog**.
2. **New > Data Model**. Under **Data Sets**, click **+ > SQL Query**:
   - Name: `DS_SQL`
   - Data Source: `ApplicationDB_FSCM`
   - **Type of SQL: Non-standard SQL** (needed, because the query starts with `WITH FUNCTION`)
   - SQL: paste `bip/FUSION_SQL_DM.sql`
3. Open **Parameters**. If BI Publisher didn't create them from the bind names, add `p_sql`
   and `p_max_rows`, both **String** with no default.
4. Save the data model as `/Custom/FusionSQL/FUSION_SQL_DM.xdm`.
5. Check it: **Data** tab, set `p_sql` to `select 'hello' as greeting from dual`, **View**.
   The output has `G_1/RESULT` holding a `ROWSET` with one `ROW`.
6. **New > Report**, *Use Data Model* `FUSION_SQL_DM.xdm`, no layout is needed. Save it as
   `/Custom/FusionSQL/FUSION_SQL_RPT.xdo`.
7. Report **Properties > Caching**: turn off the document cache. (The app also sends
   `byPassCache`, so rerunning a query never shows old rows.)
8. Give the user that will run it (the service connection user, or yours for local tests)
   permission to run reports in `/Custom/FusionSQL`.

> **Who can see what:** the data model reads with the data source's database access, not the
> Fusion user's data roles (business units, ledgers). Anyone who can run this report can read
> any table the data source can. Keep the report folder, and the VB app, limited to the people
> who may do that.

**Already have the WMS Fusion SQL report?** Point **Settings > Report path** and **SQL
parameter** at it. The app reads both a `ROWSET` result (DBMS_XMLGEN) and plain row groups
(`DATA_DS/G_1/...`). If that report has no row-limit parameter, set **Row limit** to *Wrap the
query*.

## 2. Run it locally

You need **Node.js 20** and Git. The browser can't call Fusion directly from `localhost`
(CORS), and the Fusion password must not be in the page, so a small proxy on your machine adds
the credentials, the same job VB's proxy does in VB Studio.

```powershell
cd C:\javeed\oraclevbcs
git fetch
git checkout feature/fusion-sql

# Put the portable Node 20 first for this window:
$env:Path = "C:\tools\node20;" + $env:Path

npm install
copy .env.example .env
notepad .env          # FUSION_HOST, FUSION_USER, FUSION_PASSWORD (.env is ignored by Git)
```

Then, in two terminals:

```powershell
npm run proxy         # http://localhost:8890/bip  -> https://<pod>/xmlpserver/services/ExternalReportWSSService
npm run serve         # http://localhost:8888
```

On `localhost` the app uses **Direct URL** `http://localhost:8890/bip` by default. Open
**Settings** and press **Test connection**: it runs `SELECT 'OK' ... FROM dual` through the
report and shows the Fusion server time.

In VS Code: **Terminal > Run Task > Fusion: BIP dev proxy (port 8890)**, then
**VB: local preview (port 8888)**.

The proxy listens on 127.0.0.1 only, accepts calls only from `localhost` pages, and forwards
only `runReport` requests. `http://localhost:8890/health` shows which pod and user it uses.

### A five-minute test

1. Press **Run** on the connection check: one row with your DB user and the server time.
2. Click the **GL periods** example. It is added under the first query with the cursor in it;
   press **Ctrl+Enter**. Only that statement runs.
3. Sort a date or amount column, type in **Filter these rows**, then **Copy** and paste into Excel.
4. **Tables**: search `PO_HEADERS`, open `PO_HEADERS_ALL`, click **Write a SELECT**, run it.
5. Break a query on purpose (misspell a column) and run it: the ORA error shows, cleaned up.
   With a Claude key in Settings, press **Fix with Claude**.
6. Ask Claude: *on-hand quantity by subinventory for items starting with AB*.
7. **History**: run an earlier query again.

## 3. Bring it into VB Studio

Import the branch into a workspace (or push it to the workspace's repository), then create the
service connection the page calls, **`fusionBip/runReport`**:

1. **Service Connections > + Service Connection > Define by Endpoint**.
2. Method **POST**, URL `https://<your-pod>/xmlpserver/services/ExternalReportWSSService`,
   action hint **Create**. Service name **`fusionBip`**, endpoint ID **`runReport`**.
3. **Server > Authentication: Basic**, with a Fusion user allowed to run the report.
   Connection type **Always use proxy, irrespective of CORS support**. The proxy adds the
   credentials on the server; the browser never sees them.
4. **Request**: add a static header `Content-Type: application/soap+xml; charset=UTF-8`
   (the page sets it too). The body is the SOAP envelope the page builds.
5. Preview. Away from `localhost` the app uses the service connection by default
   (**Settings > Connection**).

Then lock the app down, because of what the report can read: **Settings > Security** of the web
app: require sign-in, and grant access only to the role of the people who may query Fusion data.

Don't edit the same page in the Designer and in VS Code at the same time: pull, edit, push.

## 4. How it works

**The request** (`buildEnvelope` in `app-flow.js`), SOAP 1.2, sent as `application/soap+xml`:

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
  <soap:Header/>
  <soap:Body>
    <pub:runReport>
      <pub:reportRequest>
        <pub:attributeFormat>xml</pub:attributeFormat>
        <pub:byPassCache>true</pub:byPassCache>
        <pub:parameterNameValues>
          <pub:item><pub:name>p_sql</pub:name><pub:values><pub:item>SELECT ...</pub:item></pub:values></pub:item>
          <pub:item><pub:name>p_max_rows</pub:name><pub:values><pub:item>501</pub:item></pub:values></pub:item>
        </pub:parameterNameValues>
        <pub:reportAbsolutePath>/Custom/FusionSQL/FUSION_SQL_RPT.xdo</pub:reportAbsolutePath>
        <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
      </pub:reportRequest>
      <pub:appParams></pub:appParams>
    </pub:runReport>
  </soap:Body>
</soap:Envelope>
```

**The answer:** `runReportReturn/reportBytes` is base64. It is decoded as UTF-8 (not with a bare
`atob`, which garbles non-ASCII text) and parsed. `DATA_DS/G_1/RESULT` holds the `ROWSET` as
escaped text, so it is parsed a second time. Then:

- `xsi:nil="true"` cells become NULL, and every column keeps its place in the query order;
- column names DBMS_XMLGEN had to escape come back readable (`COUNT_x0028__x002A__x0029_` is `COUNT(*)`);
- a column is right-aligned and sorted as a number when all its values are numbers;
- faults are reduced to the ORA lines (`ORA-06512` stack lines are dropped), or to a plain
  message for HTTP 401, 403, 404 and timeouts.

**Limits worth knowing:**

- One statement per run. Bind variables can't be passed through the report; put values in the SQL.
- Very long queries can be rejected: BI Publisher parameters over about 4,000 bytes may fail.
  The app warns above that size.
- The row limit is capped at 10,000. Large results are slow in DBMS_XMLGEN; filter in SQL.
- The query runs as the report's data source (see the note in section 1).

**Claude** is called from the browser with the key kept in this browser only, like Auto Pilot in
the maintenance sample. For production, send the call through a server-side proxy (ORDS, OIC or
another backend) so the key never reaches the browser.

## 5. Troubleshooting

| Message | What to do |
|---|---|
| *The service connection endpoint fusionBip/runReport was not found* | Create it (section 3), or switch **Settings > Connection** to *Direct URL*. |
| *Could not reach http://localhost:8890/bip* | Start `npm run proxy`. Check `.env`. |
| *The dev proxy has no Fusion host or credentials* | Fill in `.env` and restart the proxy. |
| *HTTP 401* | Wrong user or password on the service connection or in `.env`. |
| *BI Publisher could not find /Custom/...* | Check the report path, and that the user may run reports in that folder. |
| `ORA-00942: table or view does not exist` | The data source can't see that object. Check the name in **Tables**, or prefix the owner (`FUSION.`). |
| `ORA-00904: invalid identifier` | A column name is wrong. Open the table in **Tables** to see its columns, or press **Fix with Claude**. |
| Same rows after a change on Fusion | Turn off the report's document cache (section 1, step 7). |
| Slow, or a timeout | Lower **Max rows**, add filters, or raise the timeout in Settings. |

## 6. Project structure

```
visual-application.json            VB 25.10 runtime, JET 18.1.4
bip/FUSION_SQL_DM.sql              data model SQL for the universal report
tools/bip-dev-proxy.js             local proxy: adds Fusion credentials for the local preview
tools/test/run-tests.js            tests for the SOAP engine, the page logic and the proxy (npm test)
webApps/fusionsql/
  app-flow.js                      SOAP engine (envelope, transports, decoding, parsing), settings,
                                   history, data dictionary SQL, Claude
  pages/fusion-sql-page.*          editor, results grid, side panel, settings dialog
  pages/fusion-sql-page-chains/    run, filter, export, panel, history, tables, ask, editor, settings
  resources/css/app.css            layout (fq- classes, Redwood variables)
```

`CLAUDE.md` lists the conventions for working on it.

## 7. How this was checked

The VB runtime and JET load from Oracle's CDN and only render in a browser, so before pushing:

- `npm test` runs the SOAP engine against real-shaped BI Publisher answers: SOAP 1.2 and 1.1
  faults, HTTP errors, base64 with Arabic text, `ROWSET` as escaped text and as
  child elements, NULLs, escaped column names, empty results, plain row groups, truncation,
  the SQL pre-checks, statement picking under the cursor, CSV and the proxy end to end against a
  mock Fusion server (credentials added, only `runReport` forwarded, CORS only for localhost);
- every chain was run against a mock VB context, including the page's full run → filter →
  copy → history → tables → Claude → settings journey;
- every JSON file parses, every listener points to an existing chain, every component used in
  the HTML is imported, and every `$functions`, `$variables` and `$listeners` reference exists;
- ESLint passes on the app, the chains and the tools.

The parts that need your pod (the data model, the service connection, your tables) can only be
checked there: **Settings > Test connection** is the quickest way.
