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

  /** Opens the drawer for one request, on its details or on its workflow diagram. */
  class openRequestChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id      request id, e.g. MR-24136
     * @param {string} [params.view]  details (default) | workflow
     */
    async run(context, { id, view } = {}) {
      const { $page, $application } = context;

      if (!id) {
        return;
      }

      // Sample data. Live version: GET /requests/{id} (with route and history) from ORDS.
      const request = $application.functions.requestById(id);
      if (!request) {
        return;
      }
      const workflow = $application.functions.requestWorkflow(id);
      $page.variables.selected = request;
      $page.variables.workflow = workflow;
      $page.variables.workflowHeadline = $application.functions.workflowHeadline(workflow);
      $page.variables.detailView = view === 'workflow' ? 'workflow' : 'details';
      $page.variables.detailOpen = true;
    }
  }

  return openRequestChain;
});
