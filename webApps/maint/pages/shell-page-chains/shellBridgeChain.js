define([
  'vb/action/actionChain',
  'vb/action/actions',
  'vb/action/actionUtils',
], (
  ActionChain,
  Actions,
  ActionUtils
) => {
  'use strict';

  const FLOWS = ['home', 'dashboard', 'requests', 'equipment', 'inbox', 'workorders'];

  /**
   * Events the app module raises on #mxBridge (see "Shell bridge" in app-flow.js):
   *  - counts: after any page changed data > header "Approvals (n)";
   *  - toast: $application.functions.message(...) > toast;
   *  - command: the desktop app's tray, menu and shortcut > navigate | settings.
   */
  class shellBridgeChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.type     counts | toast | command
     * @param {Object} params.detail   the event detail
     */
    async run(context, { type, detail } = {}) {
      const { $page, $application } = context;
      const d = detail || {};

      if (type === 'counts') {
        $page.variables.pendingCount = Number(d.pending) || 0;
        return;
      }

      if (type === 'toast') {
        $page.variables.toasts = Array.isArray(detail) ? detail : [];
        return;
      }

      if (type === 'command') {
        if (d.command === 'navigate' && FLOWS.includes(d.flow)) {
          await Actions.navigateToFlow(context, {
            flow: d.flow,
          });
          return;
        }
        if (d.command === 'settings') {
          $page.variables.apForm = $application.functions.autopilotForm();
          $page.variables.apSettings = $application.functions.autopilotSettings();
          $page.variables.apStatus = '';
          $page.functions.openDialog('apSettingsDialog');
        }
      }
    }
  }

  return shellBridgeChain;
});
