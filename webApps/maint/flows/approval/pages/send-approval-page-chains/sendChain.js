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

  /** Sends the selected drafts for approval, then refreshes the list. */
  class sendChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      const ids = Array.from($page.variables.selectedIds || []);
      if (ids.length === 0) {
        return;
      }

      $page.variables.isSending = true;

      // Sample data. Live version: POST /requests/submit with { ids, note } to ORDS.
      const sent = $application.functions.sendForApproval(ids, $page.variables.note);

      const first = sent[0];
      $application.variables.messages = $application.functions.message(
        'confirmation',
        sent.length === 1 ? `${first.id} sent for approval` : `${sent.length} requests sent for approval`,
        sent.length === 1 ? `Waiting for ${first.waitingFor}.` : 'Each one is waiting for its first approver.',
      );
      $application.variables.counts = $application.functions.counts();

      // What is left to send.
      const drafts = $application.functions.drafts();
      const remaining = drafts.map((d) => d.id);
      $page.variables.selectedIds = remaining;
      $page.variables.drafts = $page.functions.decorate(drafts, remaining);
      $page.variables.approvers = $page.functions.approvers(drafts, remaining);
      $page.variables.note = '';
      $page.variables.isSending = false;
    }
  }

  return sendChain;
});
