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

  /** The search text, the status select or the Everyone / Raised by me switch changed. */
  class filterRequestsChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]    raw text from the search field, as you type
     * @param {string} [params.status]  All | Open | Draft | Pending approval | Approved | In progress | Completed | Rejected
     * @param {string} [params.scope]   all | mine
     */
    async run(context, { text, status, scope } = {}) {
      const { $page } = context;

      if (typeof text === 'string') {
        $page.variables.searchText = text;
      } else if (text === null) {
        $page.variables.searchText = '';
      }
      if (status) {
        $page.variables.statusFilter = status;
      }
      if (scope) {
        $page.variables.scope = scope;
      }

      const v = $page.variables;
      const shown = $page.functions.filterRequests(v.all, v.statusFilter, v.scope, v.searchText);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      if (status === undefined) {
        // Only refresh the counts in the status select when something other than the status changed.
        $page.variables.statusOptionsADP.data = $page.functions.statusOptions(v.all, v.scope, v.searchText);
      }
    }
  }

  return filterRequestsChain;
});
