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

  /** The template's primary action (spPrimaryAction): sends the ticked drafts, then opens Requests. */
  class sendChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      if ($page.variables.isSending) {
        return;
      }
      const ids = Array.from($page.variables.selectedIds || []);
      if (ids.length === 0) {
        $application.variables.messages = $application.functions.message(
          'warning',
          'Nothing selected',
          'Tick at least one draft to send it for approval.',
        );
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
      $page.variables.isSending = false;

      // Show the result on the Requests page (with the request open when only one was sent).
      if (sent.length === 1) {
        $application.variables.openRequestId = first.id;
      }
      await Actions.navigateToPage(context, {
        page: 'my-requests',
      });
    }
  }

  return sendChain;
});
