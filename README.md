# Maintenance module: Oracle Visual Builder sample on Redwood page templates

A maintenance management app built with **Oracle's own Redwood page templates** (the `oj-sp`
components that Fusion Applications and VB Studio's Redwood starter use), with a request
**workflow view** and **Auto Pilot**, an assistant on Claude that answers questions about the
module's data and about Oracle in general. It runs on sample data stored in the browser, so no
backend is needed.

> The earlier version with a hand-styled sliding menu is on the `feature/maintenance-redwood` branch.

**What's inside**

| Menu item | Redwood template | What it shows |
|---|---|---|
| Home | Welcome page (`oj-sp-welcome-page`) | Greeting banner with **Raise request** and **Browse equipment**, five compact counters, what needs attention, the latest requests, and Auto Pilot questions |
| Dashboard | Dashboard landing page + scoreboard | Five KPIs; selecting one shows a compact row of small charts and short lists |
| Requests | Smart search page | Search, status and "raised by" filters, the requests table, and a drawer with **Details** and **Workflow** |
| ↳ Raise request | Simple create and edit | Validated form, the selected equipment, and the approval route that updates as you type |
| ↳ Send for approval | Simple create and edit | Tick drafts, see who approves each one, add a note, send |
| Equipment | Smart search page | Search, category and status filters, compact cards or a table, and a drawer with specs and history |
| Approvals | Smart search page | "Acting as" supervisor, plant manager or HSE officer; approve, reject with a reason, or view the workflow |
| Work orders | Smart search page | Board with Scheduled, In progress and Completed lanes; start and complete work |

The shell is the same as VB's Redwood starter: `oj-sp-pillar-theme` around everything and
**`oj-sp-in-app-navigation`** to move between the six areas. The header has **Auto Pilot** and
**Settings**.

### Workflow view

Open any request and switch the drawer to **Workflow** (or click **Workflow** next to a request ID,
**View workflow** in Approvals, or the request link on a work order). It draws the request as a
flow: raised, sent, each approver, work order, work, completed. Each step shows who and when; the
step it is waiting on is highlighted; a rejection shows where it stopped and why; approver steps
the rules skip are drawn dashed with the reason (for example "High priority and AED 3,400: the
plant manager only approves Critical requests or AED 10,000 and above").

### Auto Pilot (Claude)

1. Get a Claude API key in the [Claude Console](https://platform.claude.com/settings/keys).
2. Click **Settings** in the header, paste the key, choose a model, and **Test connection**.
3. Click **Auto Pilot** and ask, for example:
   - *What needs my attention today?*
   - *Which requests are waiting for the plant manager, and for how long?*
   - *Raise a draft request: chiller CH-02 is very noisy since this morning, high priority.*
   - *Explain the Procure to Pay flow in Oracle Fusion.* / *How do I call a Fusion REST API from VB?*

Auto Pilot calls the Claude Messages API directly from the browser. It looks up the live data
through tools (overview, requests, equipment, approval inboxes, work orders, approval routes) and
can **save draft requests**; it never sends anything for approval. The panel shows what it looked
up for each answer. Turn off "Let Auto Pilot read the maintenance data" in Settings for general
questions only.

**About the key:** it is kept in this browser only (or only until you reload, if "Remember" is
off) and is sent only to `api.anthropic.com`. That is fine for a demo. For production, call Claude
from a server-side proxy (ORDS, OIC or another backend) so the key never reaches the browser.
In VB Studio, if Auto Pilot says it cannot reach api.anthropic.com, the instance's security policy
is blocking browser calls to it; the server-side proxy is then the way to go.

**Approval rules** (worked out per request):
1. Maintenance supervisor approves every request.
2. Plant manager also approves when the priority is Critical or the cost is AED 10,000 or more.
3. HSE officer also approves Safety requests.

The last approval creates a work order. Completing the work order closes the request and puts the
equipment back in service.

---

## 1. Run it locally

You need **Node.js 20** and Git.

```powershell
cd C:\javeed\oraclevbcs
git pull

# Put the portable Node 20 first for this window:
$env:Path = "C:\tools\node20;" + $env:Path

npm install
npm run serve
```

`npm run serve` builds and opens **http://localhost:8888**; it keeps running until you press
**Ctrl+C**. If port 8888 is busy (an earlier run is still open), close that window or run
`npx grunt vb-serve:webApps/maint --port=8889 --open`. The Redwood templates, JET and the VB runtime
load from Oracle's CDN, so you need to be online.

Why the build copies the app first: VB Studio resolves the Redwood components listed in
`settings/dependencies.json` through its Component Exchange, which a local build can't reach
("Missing mandatory component exchange URL"). `npm run build` therefore builds a copy in
`.local-src/` without that list, and the templates load from Oracle's CDN through the mapping in
`app-flow.json`. Your sources don't change.

In VS Code: **Terminal > Run Task > VB: install build tools**, then **VB: local preview (port 8888)**.

### A five-minute test

1. **Home:** click a counter or a "needs attention" row; the app opens the right place.
2. **Dashboard:** click each KPI in the scoreboard; the panels below change.
3. **Equipment:** search "krones", pick the HVAC category, switch to Table. Open an asset, then
   **Raise request for this asset**.
4. **Raise request:** the equipment is already chosen. Set priority to **Critical** and type to
   **Safety**; the approval route grows to three steps. **Save**. Requests opens with your request.
5. Switch the drawer to **Workflow**: three approvals ahead, the first one highlighted.
6. **Approvals:** approve it as Maintenance supervisor, then switch "Acting as" to Plant manager
   and HSE officer. Click **View workflow** between approvals to watch it move.
7. **Work orders:** **Start work**, then **Mark complete**. The workflow ends at Completed.
8. **Auto Pilot:** add your key in **Settings**, then ask one of the suggested questions.

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
  app-flow.js                     oj-sp config + sample data store + workflow builder + Auto Pilot
  settings/dependencies.json      Redwood components this web app uses
  pages/shell-page.*              pillar theme, header, in-app navigation, toasts, router,
                                  Auto Pilot panel and settings
  flows/home/                     welcome page
  flows/dashboard/                dashboard landing page
  flows/requests/                 my-requests (with workflow view), raise-request, send-approval
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
| `requestWorkflow(id)` | `GET /requests/{id}/workflow` (or built from `GET /requests/{id}`) |
| `createRequest(form, submit)` | `POST /requests` (+ `POST /requests/{id}/submit`) |
| `sendForApproval(ids, note)` | `POST /requests/submit` |
| `inbox(role)`, `decide(id, role, approve, comment)` | `GET /approvals?role=`, `POST /requests/{id}/decision` |
| `workOrderList()`, `advanceWorkOrder(id)` | `GET /work-orders`, `PATCH /work-orders/{id}` |
| `askAutopilot(history, text)` | `POST /assistant/messages` on your proxy, which holds the Claude key |

The approval rules then move to PL/SQL, so the route is decided on the server. Auto Pilot's tools
keep working unchanged as long as the store methods return the same shapes.

## 5. How this was checked

The Redwood templates come from Oracle's CDN and can only render in a browser, so before pushing:

- the template markup (attributes, slots, events, component paths and versions) follows Oracle's
  Redwood sample applications; the one attribute not seen there is `primary-action.label` on the
  create and edit pages (if your version ignores it, the button simply says **Save**);
- every JSON file parses, every listener points to an existing chain with matching parameters,
  every component is imported and listed in `dependencies.json`, and every variable, function,
  flow, page and CSS class referenced exists;
- ESLint passes on all page modules and chains;
- every chain was run against a mock VB context, every listener was fired, and every binding in
  the HTML was evaluated for every row and item (9,000+ evaluations), including the workflow view
  for a request in each status and a real Auto Pilot conversation;
- Auto Pilot was run against a mock of the Claude Messages API that checks the headers and the
  tool_use / tool_result pairing: tool lookups, saving a draft, a bad key, Ctrl+Enter, and a
  question queued from Home;
- the full journey (raise, three approvals, work order, complete; send drafts; reject with and
  without a reason; raise from an asset) was run through the real chains.

If anything shows an error in the browser, the console (F12) has the details.
