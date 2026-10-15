# CLAUDE.md: working on this Visual Builder app

This repo is an **Oracle Visual Builder (VB) visual application** built on **Oracle's Redwood page
templates** (the `oj-sp` components), not a React or Node app. VB reads the JSON/HTML/JS files at
runtime; there is no bundler and no JSX.

## Layout

```
visual-application.json            VB 25.10 runtime, JET 18.1.4 - do not hand-edit versions
settings/dependencies.json         oj-sp components available to the app (as in Oracle's Redwood starter)
package.json, Gruntfile.js         grunt-vb-build 2510 tooling (build/serve/serve:cdn/audit/package). Node 20.
webApps/maint/
  index.html                       VB entry page
  app-flow.json                    requirejs paths/bundles for oj-sp on Oracle's CDN, app variables
                                   (counts, messages, prefillEquipmentId, openRequestId), CSS import
  app-flow.js                      define(['oj-sp/spectra-shell/config/config']) + sample data store
  settings/dependencies.json       oj-sp components this web app uses (must list every oj-sp-* tag)
  pages/shell-page.*               oj-sp-pillar-theme, header, oj-sp-in-app-navigation, toasts, router
  pages/shell-page-chains/         initShell, navigate, resetDemo
  flows/<flow>/<flow>-flow.json    one flow per navigation item
  flows/<flow>/pages/<page>-page.{json,html,js} and <page>-page-chains/
  resources/css/app.css            layout inside the templates only: mx- prefix, --oj-core-* variables
```

| Navigation item | Flow | Pages (default first) | Redwood template |
|---|---|---|---|
| Home | home | welcome | oj-sp-welcome-page + oj-sp-object-card |
| Dashboard | dashboard | overview | oj-sp-dashboard-landing-page + scoreboard / dashboard-grid / dashboard-panel |
| Requests | requests | my-requests, raise-request, send-approval | smart-search-page; simple-create-edit for the other two |
| Equipment | equipment | browse-equipment | oj-sp-smart-search-page + oj-sp-object-card |
| Approvals | inbox | approval-inbox | oj-sp-smart-search-page |
| Work orders | workorders | work-orders | oj-sp-smart-search-page |

Detail drawers are `oj-drawer-popup` with `oj-sp-general-drawer-template` inside.

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
   `$application.variables.openRequestId` before navigating to Requests.
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
11. After any change run `npm run build` (or `npm run serve:cdn` if the build asks for the
    Component Exchange) and fix errors before committing.

## Data

All data comes from the store in `app-flow.js` (`equipmentList`, `requestList`, `createRequest`,
`sendForApproval`, `decide`, `advanceWorkOrder`, `dashboard`, ...). Every chain that touches data
has a `// Sample data. Live version: ...` comment naming the ORDS call that would replace it.
