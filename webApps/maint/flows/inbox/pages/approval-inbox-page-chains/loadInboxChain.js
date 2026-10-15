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

  /** Loads what is waiting for the chosen role (on page entry and when a role tab is clicked). */
  class loadInboxChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.roleId]  supervisor | manager | hse
     */
    async run(context, { roleId } = {}) {
      const { $page, $application } = context;

      $application.variables.activeNav = 'inbox';
      if (roleId) {
        $page.variables.role = roleId;
      }

      // Sample data. Live version: GET /approvals?role={role}&status=Waiting from ORDS.
      const counts = $application.functions.counts();
      $application.variables.counts = counts;
      $page.variables.items = $application.functions.inbox($page.variables.role);
      $page.variables.roleTabs = $page.functions.roleTabs($application.functions.roles(), counts, $page.variables.role);
    }
  }

  return loadInboxChain;
});
