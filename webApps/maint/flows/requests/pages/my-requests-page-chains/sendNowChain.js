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

  /** "Send for approval" from the drawer of a draft request. */
  class sendNowChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      // Sample data. Live version: POST /requests/{id}/submit to ORDS.
      const sent = $application.functions.sendForApproval([id], '');
      if (!sent.length) {
        return;
      }

      const request = sent[0];
      $application.variables.messages = $application.functions.message(
        'confirmation',
        `${request.id} sent for approval`,
        `Waiting for ${request.waitingFor}.`,
      );
      const counts = $application.functions.counts();
      $application.variables.counts = counts;
      $page.variables.draftCount = counts.drafts;

      // Refresh the drawer and the list.
      $page.variables.selected = $application.functions.requestById(id);
      const workflow = $application.functions.requestWorkflow(id);
      $page.variables.workflow = workflow;
      $page.variables.workflowHeadline = $application.functions.workflowHeadline(workflow);
      const all = $application.functions.requestList();
      $page.variables.all = all;
      const v = $page.variables;
      const shown = $page.functions.filterRequests(all, v.statusFilter, v.scope, v.searchText);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      $page.variables.statusOptionsADP.data = $page.functions.statusOptions(all, v.scope, v.searchText);
    }
  }

  return sendNowChain;
});
