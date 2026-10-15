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

  /** A status chip or the Everyone / Raised by me switch changed. */
  class filterRequestsChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.status]  chip key: All | Open | Draft | Pending approval | ...
     * @param {string} [params.scope]   all | mine
     */
    async run(context, { status, scope } = {}) {
      const { $page } = context;

      if (status) {
        $page.variables.statusFilter = status;
      }
      if (scope) {
        $page.variables.scope = scope;
      }

      const all = $page.variables.all;
      const shown = $page.functions.filterRequests(all, $page.variables.statusFilter, $page.variables.scope);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      $page.variables.statusChips = $page.functions.statusChips(all, $page.variables.statusFilter, $page.variables.scope);
    }
  }

  return filterRequestsChain;
});
