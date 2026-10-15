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

  /** Loads all requests when the page opens and applies the current filters. */
  class loadRequestsChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.activeNav = 'requests';

      // Sample data. Live version: GET /requests from ORDS.
      const all = $application.functions.requestList();
      $page.variables.all = all;

      const shown = $page.functions.filterRequests(all, $page.variables.statusFilter, $page.variables.scope);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      $page.variables.statusChips = $page.functions.statusChips(all, $page.variables.statusFilter, $page.variables.scope);
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadRequestsChain;
});
