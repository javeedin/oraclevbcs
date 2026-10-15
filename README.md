# Maintenance module: Oracle Visual Builder sample (Redwood style)

A maintenance management app built as a standard Visual Builder web app, so you can develop it in
VS Code, test it locally, then bring it into VB Studio. It runs entirely on sample data stored in
the browser, so no backend is needed.

**What's inside**

| Screen | What it shows |
|---|---|
| Dashboard | Welcome banner, 5 KPIs, quick actions, requests-by-status donut, requests per week by priority, needs attention, equipment health, PM due, recent requests |
| Raise request | Form with validation (equipment, title, description, type, priority, needed by, cost, equipment down), plus a live equipment card and the approval route the request will follow |
| My requests | Status chips with counts, Everyone / Raised by me, table, and a side drawer with the approval steps and timeline |
| Send for approval | Pick drafts, see who approves each one, add a note, send |
| Browse equipment | Search, category chips, status filter, card or table view, and a side drawer with specs and maintenance history |
| Approval inbox | "Acting as" role tabs (supervisor, plant manager, HSE officer), approve, or reject with a required reason |
| Work orders | Board with Scheduled, In progress and Completed lanes; start and complete work |

The app shell has a Redwood-style header and a **sliding left menu** (`oj-drawer-layout`) with
badge counts. On small screens the menu slides over the page.

**Approval rules** (worked out per request):
1. Maintenance supervisor approves every request.
2. Plant manager also approves when the priority is Critical or the cost is AED 10,000 or more.
3. HSE officer also approves Safety requests.

The last approval creates a work order automatically. Completing the work order closes the request
and puts the equipment back in service.

---

## 1. Run it locally

You need **Node.js 20** (Oracle's build tools fail on Node 24 with `Unexpected identifier 'assert'`)
and Git.

```powershell
cd C:\javeed
git clone https://github.com/javeedin/oraclevbcs.git
cd oraclevbcs
git checkout feature/maintenance-redwood

# If "node -v" shows v24, put the portable Node 20 first for this window:
$env:Path = "C:\tools\node20;" + $env:Path
node -v

npm install
npx grunt vb-process-local
npx grunt vb-serve:webApps/maint --port=8888 --open
```

The browser opens the dashboard. `vb-serve` keeps running until you press **Ctrl+C**.
JET and the VB runtime load from Oracle's CDN, so you need to be online.

In VS Code the same steps are tasks: **Terminal > Run Task > VB: install build tools**, then
**VB: local preview (port 8888)**. **Ctrl+Shift+B** runs the build check.

### A five-minute test

1. **Dashboard:** click a KPI or a quick action; the menu highlight follows you.
2. **Hide menu:** use the button at the top left. The menu slides away, and back again.
3. **Browse equipment:** search "krones", pick the HVAC chip, switch to Table. Open an asset, then
   click **Raise request for this asset**.
4. **Raise request:** the equipment is already chosen. Set priority to **Critical** and type to
   **Safety** and watch the approval route grow to three steps. **Submit for approval.**
5. **Approval inbox:** approve it as Maintenance supervisor, then switch to Plant manager and
   HSE officer and approve again. A toast tells you the work order was created.
6. **Work orders:** **Start work**, then **Mark complete**.
7. **My requests:** open your request to see every step on the timeline.
8. Try **Reject** in the inbox without a reason (it refuses), then with one.

Your changes are saved in the browser. **Reset sample data** at the bottom of the menu starts
again.

## 2. Bring it into VB Studio

1. In VB Studio, create a project with a Git repository and choose to **import an existing
   repository**, pointing it at this GitHub repo and branch (or push this branch to the project's
   repository).
2. Create a workspace on that repository and open the visual application in the Designer.
3. Press **Preview**. The Designer's preview is the reference; the local `vb-serve` run is the quick check.
4. VB Studio may update `package.json` to match your instance's build-tools version. Keep that
   change. Oracle documents the current build tools for Node 20 or 22.

Don't edit the same page in the Designer and in VS Code at the same time: pull, edit, push.

## 3. Project structure

```
webApps/maint/
  app-flow.json / app-flow.js     app variables + the sample data store and formatters
  pages/shell-page.*              header, sliding menu, toasts, router
  flows/dashboard/                overview page
  flows/request/                  raise-request page
  flows/requests/                 my-requests page
  flows/approval/                 send-approval page
  flows/equipment/                browse-equipment page
  flows/inbox/                    approval-inbox page
  flows/workorders/               work-orders page
  resources/css/app.css           Redwood-style look (mx- classes, --mx- tokens)
```

Each page is `<name>-page.json` (variables, listeners, component imports), `<name>-page.html`
(JET components and markup), `<name>-page.js` (page functions) and `<name>-page-chains/`
(one JavaScript action chain per file). `CLAUDE.md` lists the conventions.

## 4. Going live with real data

Every chain that reads or changes data calls one store method in `app-flow.js`, marked with a
`// Sample data. Live version: ...` comment. Replace each call with `Actions.callRest(...)` on a
service connection to ORDS that returns the same shape:

| Store method | ORDS endpoint it stands for |
|---|---|
| `dashboard()` | `GET /maintenance/dashboard` |
| `equipmentList()`, `equipmentById(id)`, `equipmentRequests(id)` | `GET /equipment`, `GET /equipment/{id}`, `GET /equipment/{id}/requests` |
| `requestList()`, `requestById(id)`, `drafts()` | `GET /requests`, `GET /requests/{id}`, `GET /requests?status=Draft` |
| `createRequest(form, submit)` | `POST /requests` (+ `POST /requests/{id}/submit`) |
| `sendForApproval(ids, note)` | `POST /requests/submit` |
| `inbox(role)`, `decide(id, role, approve, comment)` | `GET /approvals?role=`, `POST /requests/{id}/decision` |
| `workOrderList()`, `advanceWorkOrder(id)` | `GET /work-orders`, `PATCH /work-orders/{id}` |

The approval rules then move to PL/SQL, so the route is decided on the server.

## 5. How this was checked

The VB runtime can't run outside a browser with Oracle's CDN, so before pushing:

- every JSON file parses, every listener points to an existing chain, every JET tag is imported,
  and every variable, function, flow and CSS class referenced actually exists;
- ESLint passes on all page modules and chains;
- every action chain was run against a mock VB context, and every binding in the HTML (including
  inside for-each, table and chart templates) was evaluated against the resulting data;
- the full journey (raise, three approvals, work order, complete; and reject with and without a
  reason) was run through the real chains.

The first true test of the JET rendering is `vb-serve` or the Designer preview. If anything shows
an error there, the browser console (F12) has the details.
