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
      $application.variables.counts = $application.functions.counts();

      // Refresh the drawer and the list.
      $page.variables.selected = $application.functions.requestById(id);
      const all = $application.functions.requestList();
      $page.variables.all = all;
      const shown = $page.functions.filterRequests(all, $page.variables.statusFilter, $page.variables.scope);
      $page.variables.requestsADP.data = shown;
      $page.variables.shownCount = shown.length;
      $page.variables.statusChips = $page.functions.statusChips(all, $page.variables.statusFilter, $page.variables.scope);
    }
  }

  return sendNowChain;
});
