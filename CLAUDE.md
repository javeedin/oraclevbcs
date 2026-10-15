# CLAUDE.md: working on this Visual Builder app

This repo is an **Oracle Visual Builder (VB) visual application**, not a React or Node app.
VB reads the JSON/HTML/JS files at runtime; there is no bundler and no JSX.

## Layout

```
visual-application.json            app metadata (VB/JET versions) - do not hand-edit versions
package.json, Gruntfile.js         grunt-vb-build tooling (build/serve/audit/package). Needs Node 20.
webApps/maint/
  index.html                       VB entry page
  app-flow.json / app-flow.js      app variables (activeNav, counts, messages, prefillEquipmentId),
                                   CSS import, and the sample data store + formatters
  pages/shell-page.*               shell: header, sliding menu (oj-drawer-layout), toasts, router
  pages/shell-page-chains/         initShell, toggleNav, navigate, resetDemo
  flows/<flow>/<flow>-flow.json    one flow per menu item; defaultPage is its only page
  flows/<flow>/pages/<page>-page.{json,html,js} and <page>-page-chains/
  resources/css/app.css            all styling, mx- prefix, tokens in :root
```

| Menu item | Flow | Page |
|---|---|---|
| Dashboard | dashboard | overview |
| Raise request | request | raise-request |
| My requests | requests | my-requests |
| Send for approval | approval | send-approval |
| Browse equipment | equipment | browse-equipment |
| Approval inbox | inbox | approval-inbox |
| Work orders | workorders | work-orders |

## Rules

1. **Every page is a triplet** `<name>-page.json/.html/.js`, plus `<name>-page-chains/` for chains.
2. **Action chains are JS classes** (`codeChainsEnabled` is on). The class name must equal the
   file name. Use `async run(context, { param } = {})` so a call without parameters is safe.
3. **Wiring events:** `on-oj-action="[[$listeners.x]]"` (JET) or `on-click="[[$listeners.x]]"`
   (plain elements). The listener name must exist in the page JSON `eventListeners`. Parameters
   use `{{ $event.detail.value }}`, or `{{ $current.data.id }}` / `{{ $current.row.id }}` inside
   `oj-bind-for-each` and `oj-table` templates.
4. **Navigation:** the shell shows a flow with `Actions.navigateToFlow(context, { flow })`.
   A page inside a flow opens a sibling flow with `{ target: 'parent', flow }` (see goToChain).
   Each page's entry chain sets `$application.variables.activeNav` so the menu highlights it.
5. **Binding syntax:** `[[ ]]` one-way, `{{ }}` two-way. Page functions are `$functions.x()` in
   HTML and `$page.functions.x()` in chains; app functions are `$application.functions.x()` in both.
6. **Every JET component used in HTML must be imported** in the page JSON `imports.components`.
7. **Collections** for oj-table / oj-chart / oj-select-single use `vb/ArrayDataProvider2`
   variables; replace rows with `$page.variables.someADP.data = newArray`.
8. **Don't rely on `this`** inside page or app module methods; use module-level helper functions.
9. **Styling:** classes in `app.css` with the `mx-` prefix and the `--mx-*` tokens.
10. After any change run `npx grunt vb-process-local` and fix errors before committing.

## Data

All data comes from the store in `app-flow.js` (`equipmentList`, `requestList`, `createRequest`,
`sendForApproval`, `decide`, `advanceWorkOrder`, `dashboard`, ...). Every chain that touches data
has a `// Sample data. Live version: ...` comment naming the ORDS call that would replace it.
