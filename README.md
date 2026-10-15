# Maintenance module: Oracle Visual Builder sample on Redwood page templates

A maintenance management app built with **Oracle's own Redwood page templates** (the `oj-sp`
components that Fusion Applications and VB Studio's Redwood starter use), so it looks and behaves
like an Oracle Redwood app. It runs on sample data stored in the browser, so no backend is needed.

> The earlier version with a hand-styled sliding menu is on the `feature/maintenance-redwood` branch.

**What's inside**

| Menu item | Redwood template | What it shows |
|---|---|---|
| Home | Welcome page (`oj-sp-welcome-page`) | Greeting banner with **Raise request** and **Browse equipment**, then object cards for what needs attention, shortcuts (Send for approval, Approval inbox, Work orders) and the latest requests |
| Dashboard | Dashboard landing page (`oj-sp-dashboard-landing-page`, `oj-sp-scoreboard`, `oj-sp-dashboard-grid`, `oj-sp-dashboard-panel`) | Five KPIs; selecting one shows its panels: requests by status and per week, approvals waiting, equipment health and what is down, work orders, preventive maintenance due and overdue |
| Requests | Smart search page (`oj-sp-smart-search-page`) | Search, status and "raised by" filters, the requests table, and a drawer (`oj-sp-general-drawer-template`) with the approval route and timeline |
| ↳ Raise request | Simple create and edit (`oj-sp-simple-create-edit`) | Validated form, the selected equipment, and the approval route that updates as you type |
| ↳ Send for approval | Simple create and edit | Tick drafts, see who approves each one, add a note, send |
| Equipment | Smart search page + object cards | Search, category and status filters, cards or table, and a drawer with specs and history |
| Approvals | Smart search page | "Acting as" supervisor, plant manager or HSE officer; approve, or reject with a required reason |
| Work orders | Smart search page | Board with Scheduled, In progress and Completed lanes; start and complete work |

The shell is the same as VB's Redwood starter: `oj-sp-pillar-theme` around everything and
**`oj-sp-in-app-navigation`** to move between the six areas.

**Approval rules** (worked out per request):
1. Maintenance supervisor approves every request.
2. Plant manager also approves when the priority is Critical or the cost is AED 10,000 or more.
3. HSE officer also approves Safety requests.

The last approval creates a work order. Completing the work order closes the request and puts the
equipment back in service.

---

## 1. Run it locally

You need **Node.js 20** and Git. The build tools are now the 25.10 ones (the same as Oracle's
Redwood starter app), so run `npm install` again after you switch to this branch.

```powershell
cd C:\javeed\oraclevbcs
git fetch
git checkout feature/maintenance-redwood-templates

# Put the portable Node 20 first for this window:
$env:Path = "C:\tools\node20;" + $env:Path
node -v

npm install
npm run serve
```

`npm run serve` cleans, builds and opens **http://localhost:8888**. It keeps running until you
press **Ctrl+C**. The Redwood templates, JET and the VB runtime all load from Oracle's CDN
(static.oracle.com), so you need to be online.

**If the build stops and asks for a Component Exchange URL**, run this instead:

```powershell
npm run serve:cdn
```

It builds from a copy of the app without the component list, and the templates still load from
Oracle's CDN through the mapping in `app-flow.json`. Nothing in your sources changes.

In VS Code the same steps are tasks: **Terminal > Run Task > VB: install build tools**, then
**VB: local preview (port 8888)** (or the *Redwood from CDN only* variant).

### A five-minute test

1. **Home:** the banner greets you and shows what is waiting. Click a card, for example a
   critical request, and the app opens the right place.
2. **Dashboard:** click each KPI in the scoreboard; the panels below change.
3. **Equipment:** search "krones", pick the HVAC category, switch to Table. Open an asset, then
   **Raise request for this asset**.
4. **Raise request:** the equipment is already chosen. Set priority to **Critical** and type to
   **Safety**; the approval route grows to three steps. **Save**. Requests opens with your
   request in the drawer.
5. **Approvals:** approve it as Maintenance supervisor, then switch "Acting as" to Plant manager
   and HSE officer. The last approval creates a work order.
6. **Work orders:** **Start work**, then **Mark complete**.
7. **Requests:** use the banner to **Send for approval** your drafts.
8. Try **Reject** in Approvals without a reason (it refuses), then with one.

**Reset sample data** in the header starts again.

## 2. Bring it into VB Studio

Import the zip as a new workspace (or push this branch to the workspace's repository), open the
visual application and press **Preview**.

- VB Studio may offer to **upgrade** the application and the Redwood components to your
  instance's version. Accept both: the runtime and the `oj-sp` components are upgraded together.
- In the Designer, the Redwood templates show up in **Create Page**, and the Redwood components in
  the Components palette, because `settings/dependencies.json` lists them.

Don't edit the same page in the Designer and in VS Code at the same time: pull, edit, push.

## 3. Project structure

```
visual-application.json           VB 25.10 runtime, JET 18.1.4
settings/dependencies.json        Redwood (oj-sp) components available to the app
webApps/maint/
  app-flow.json                   requirejs mapping for oj-sp on Oracle's CDN, app variables
  app-flow.js                     loads oj-sp/spectra-shell/config/config + the sample data store
  settings/dependencies.json      Redwood components this web app uses
  pages/shell-page.*              pillar theme, header, in-app navigation, toasts, router
  flows/home/                     welcome page
  flows/dashboard/                dashboard landing page
  flows/requests/                 my-requests, raise-request, send-approval pages
  flows/equipment/                browse-equipment page
  flows/inbox/                    approval-inbox page
  flows/workorders/               work-orders page
  resources/css/app.css           layout inside the templates (mx- classes, Redwood variables)
```

Each page is `<name>-page.json` (variables, listeners, component imports), `<name>-page.html`,
`<name>-page.js` (page functions) and `<name>-page-chains/` (one JavaScript action chain per
file). `CLAUDE.md` lists the conventions.

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

The Redwood templates come from Oracle's CDN and can only render in a browser, so before pushing:

- the template markup (attributes, slots, events, component paths and versions) follows Oracle's
  Redwood sample applications; the one attribute not seen there is `primary-action.label` on the
  create and edit pages (if your version ignores it, the button simply says **Save**);
- every JSON file parses, every listener points to an existing chain with matching parameters,
  every component is imported and listed in `dependencies.json`, and every variable, function,
  flow, page and CSS class referenced exists;
- ESLint passes on all page modules and chains;
- every chain was run against a mock VB context, every binding in the HTML (including inside
  list, table, chart and for-each templates) was evaluated against the resulting data, and every
  listener was fired;
- the full journey (raise, three approvals, work order, complete; send drafts; reject with and
  without a reason; raise from an asset) was run through the real chains.

If anything shows an error in the browser, the console (F12) has the details.
