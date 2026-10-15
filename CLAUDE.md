# CLAUDE.md: working on this Visual Builder app

This repo is an **Oracle Visual Builder (VB) visual application** built on **Oracle's Redwood page
templates** (the `oj-sp` components), not a React or Node app. VB reads the JSON/HTML/JS files at
runtime; there is no bundler and no JSX.

## Layout

```
visual-application.json            VB 25.10 runtime, JET 18.1.4 - do not hand-edit versions
settings/dependencies.json         oj-sp components available to the app (as in Oracle's Redwood starter)
package.json, Gruntfile.js         grunt-vb-build 2510 tooling. Node 20. `npm run build`/`serve` build a copy in
                                   .local-src/ without component-dependencies (no Component Exchange locally).
                                   `npm run build:desktop` also captures the built app for the desktop client.
desktop/                           Electron desktop client (NOT part of the VB app, see desktop/README.md):
                                   main.js, preload.js (window.mxDesktop), lib/server.js, lib/store.js,
                                   scripts/build-app.js (fills desktop/app), scripts/selftest.js
.github/workflows/desktop.yml      builds + smoke-tests the desktop client; on a v* tag publishes the
                                   Windows installer as a GitHub release (Maintenance-Setup.exe)
webApps/maint/
  index.html                       VB entry page
  app-flow.json                    requirejs paths/bundles for oj-sp on Oracle's CDN, app variables
                                   (counts, messages, prefillEquipmentId, openRequestId, openRequestView), CSS import
  app-flow.js                      define(['oj-sp/spectra-shell/config/config']) + sample data store,
                                   workflow builder (requestWorkflow), shell bridge + desktop client
                                   (DESKTOP, shellEvent) and Auto Pilot (Claude API + tools)
  settings/dependencies.json       oj-sp components this web app uses (must list every oj-sp-* tag)
  pages/shell-page.*               oj-sp-pillar-theme, header (Download desktop app, Approvals (n)),
                                   #mxBridge, oj-sp-in-app-navigation, toasts, router,
                                   Auto Pilot panel (oj-drawer-popup, modeless) and its settings dialog
  pages/shell-page-chains/         initShell, navigate, resetDemo, toggleAutopilot, autopilotSend,
                                   autopilotSettings, newChat, shellBridge, downloadDesktop
  flows/<flow>/<flow>-flow.json    one flow per navigation item
  flows/<flow>/pages/<page>-page.{json,html,js} and <page>-page-chains/
  resources/css/app.css            typeface (--oj-html-font-family: Oracle Sans, then bundled Inter) and
                                   layout inside the templates: mx- prefix, --oj-core-* variables
  resources/fonts/                 Inter variable woff2 (OFL) used when Oracle Sans is not installed
```

| Navigation item | Flow | Pages (default first) | Redwood template |
|---|---|---|---|
| Home | home | welcome | oj-sp-welcome-page + compact counters and lists |
| Dashboard | dashboard | overview | oj-sp-dashboard-landing-page + oj-sp-scoreboard + compact panels |
| Requests | requests | my-requests, raise-request, send-approval | smart-search-page; simple-create-edit for the other two |
| Equipment | equipment | browse-equipment | oj-sp-smart-search-page + compact cards / oj-table |
| Approvals | inbox | approval-inbox | oj-sp-smart-search-page |
| Work orders | workorders | work-orders | oj-sp-smart-search-page |

Detail drawers are `oj-drawer-popup` with `oj-sp-general-drawer-template` inside. The request drawer has
Details and Workflow views (`detailView`); the workflow nodes come from `requestWorkflow(id)`.
User feedback: keep Home and Dashboard compact (no big cards, small charts ~12rem).

## Rules

1. **Every page is a triplet** `<name>-page.json/.html/.js`, plus `<name>-page-chains/` for chains.
2. **Action chains are JS classes** (`codeChainsEnabled` is on). The class name must equal the
   file name. Use `async run(context, { param } = {})` so a call without parameters is safe.
3. **Wiring events:** `on-oj-action` (JET), `on-click` (plain elements), `on-sp-primary-action`,
   `on-sp-secondary-action`, `on-sp-cancel`, `on-sp-go-to-parent`, `on-sp-close`,
   `on-sp-selection-action` (Redwood templates), `on-oj-item-action` (card lists:
   `$event.detail.context.key` / `.data`). The listener must exist in the page JSON `eventListeners`.
4. **Redwood templates:** use only attributes, slots and events seen in Oracle's Redwood samples
   (e.g. `slot="search"` on smart search pages, `slot="main"` on simple create/edit, `slot="kpi"`
   for the scoreboard). Import each as `oj-sp/<name>/loader` and list `<name>` in
   `webApps/maint/settings/dependencies.json`.
5. **Navigation:** the shell shows a flow with `Actions.navigateToFlow(context, { flow })`. A page
   opens a sibling flow with `{ target: 'parent', flow, page? }` (goToChain) and a page of its own
   flow with `Actions.navigateToPage(context, { page })` (openPageChain). The in-app navigation
   highlights itself from `$page.currentFlow`. To open one request on arrival, set
   `$application.variables.openRequestId` (and `openRequestView = 'workflow'`) before navigating to Requests
   (goToChain takes `requestId` and `view`). To ask Auto Pilot from a page, call
   `$application.functions.openAutopilot(prompt)`; the shell opens the panel and asks.
6. **Binding syntax:** `[[ ]]` one-way, `{{ }}` two-way. Page functions are `$functions.x()` in
   HTML and `$page.functions.x()` in chains; app functions are `$application.functions.x()` in both.
7. **Every component used in HTML must be imported** in the page JSON `imports.components`.
8. **Collections** for oj-table / oj-list-view / oj-chart / oj-select-single / oj-sp-scoreboard use
   `vb/ArrayDataProvider2` variables; replace rows with `$page.variables.someADP.data = newArray`.
   The item type must declare every field the template reads (VB drops undeclared fields).
9. **Don't rely on `this`** inside page or app module methods; use module-level helper functions.
10. **Styling:** Redwood first (`oj-badge`, `oj-panel`, `oj-typography-*`, `oj-text-color-*`,
    `oj-flex`); `app.css` only for layout, with the `mx-` prefix and `--oj-core-*` variables.
    Status badges come from `badgeClass`, `priorityBadgeClass`, `equipmentBadgeClass` in app-flow.js.
    Typography: change fonts and weights through Redwood's variables (`--oj-html-font-family`,
    `--oj-typography-*`, `--oj-badge-*`), not by restyling components. User wants a refined look:
    weights 500-650 rather than 700+, tabular numbers for figures.
11. **Auto Pilot** calls the Claude Messages API from the browser (`x-api-key`, `anthropic-version: 2023-06-01`,
    `anthropic-dangerous-direct-browser-access: true`). Tools are defined in `AP_TOOLS` and run in
    `apRunTool` against the store; only `create_draft_request` writes, and only drafts. Answers render
    from markdown to blocks (`apBlocks`), never innerHTML. The key lives in localStorage (or memory);
    in the desktop client it lives in the desktop app and the page never sees it (rule 13).
12. **Shell bridge:** the header count, the toasts and the Auto Pilot panel are shell *page* variables
    (`pendingCount`, `toasts`, `apOpen`) set by `shellBridgeChain` / `autopilotSendChain` from DOM events
    that app-flow.js raises on `<span id="mxBridge">`: `counts()` raises `mxcounts`, `message()` raises
    `mxtoast`, `openAutopilot()` raises `mxask`, desktop tray/menu commands raise `mxcommand`. So call
    `counts()` after every data change and build toasts with `message()`. Don't bind shell HTML to
    `$application.variables` that flow pages change: the header showed "Approvals (0)" that way.
    Bridge event names are lower case (`on-mxcounts`), so the attribute maps to the event as is.
13. **Desktop client** (`desktop/`, Electron): `window.mxDesktop` exists only there (`DESKTOP` in
    app-flow.js). It keeps the Claude key in OS secure storage and makes the Claude call in the main
    process (`apCall` uses `mxDesktop.claude()`), shows the pending count on the tray and taskbar, notifies
    when Auto Pilot answers in the background, and sends tray/menu/shortcut commands. Keep preload.js,
    main.js (IPC checks) and app-flow.js in step. The header "Download desktop app" button (hidden in the
    desktop app) opens `releases/latest/download/Maintenance-Setup.exe` on GitHub.
14. After any change run `npm run build` and fix errors before committing; `npm run lint` covers
    webApps and desktop. Desktop releases: bump `desktop/package.json` version, tag `v<version>`, push.

## Data

All data comes from the store in `app-flow.js` (`equipmentList`, `requestList`, `createRequest`,
`sendForApproval`, `decide`, `advanceWorkOrder`, `dashboard`, ...). Every chain that touches data
has a `// Sample data. Live version: ...` comment naming the ORDS call that would replace it.
