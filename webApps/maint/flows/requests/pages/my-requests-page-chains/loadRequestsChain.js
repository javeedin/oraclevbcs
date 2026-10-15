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

  /**
   * Loads all requests when the page opens and applies the current filters.
   * If another page asked to open one request ($application.variables.openRequestId), opens its drawer
   * on details or on the workflow ($application.variables.openRequestView).
   */
  class loadRequestsChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /requests from ORDS.
      const all = $application.functions.requestList();
      $page.variables.all = all;

      const v = $page.variables;
      const shown = $page.functions.filterRequests(all, v.statusFilter, v.scope, v.searchText);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      $page.variables.statusOptionsADP.data = $page.functions.statusOptions(all, v.scope, v.searchText);

      const counts = $application.functions.counts();
      $application.variables.counts = counts;
      $page.variables.draftCount = counts.drafts;

      const openId = $application.variables.openRequestId;
      if (openId) {
        const view = $application.variables.openRequestView;
        $application.variables.openRequestId = '';
        $application.variables.openRequestView = '';
        // Sample data. Live version: GET /requests/{id} from ORDS.
        const request = $application.functions.requestById(openId);
        if (request) {
          const workflow = $application.functions.requestWorkflow(openId);
          $page.variables.selected = request;
          $page.variables.workflow = workflow;
          $page.variables.workflowHeadline = $application.functions.workflowHeadline(workflow);
          $page.variables.detailView = view === 'workflow' ? 'workflow' : 'details';
          $page.variables.detailOpen = true;
        }
      }
    }
  }

  return loadRequestsChain;
});
