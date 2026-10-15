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
   * Approve or reject the current step of a request for the role in use.
   * Approve: next approver, or a new work order on the last step.
   * Reject: needs a reason; the request is closed as Rejected.
   */
  class decideChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id
     * @param {boolean} params.approve
     * @param {string} [params.comment]
     */
    async run(context, { id, approve, comment } = {}) {
      const { $page, $application } = context;
      const isApprove = approve === true;

      let reason = String(comment || '').trim();
      if (!isApprove && !reason) {
        // The text area may not have committed its value yet if the button was clicked while typing.
        reason = $page.functions.rawText('rejectReason').trim();
      }
      if (!isApprove && !reason) {
        $page.variables.rejectError = 'Add a reason so the requester knows what to change.';
        return;
      }

      // Sample data. Live version: POST /requests/{id}/decision with { role, approve, comment } to ORDS.
      const result = $application.functions.decide(id, $page.variables.role, isApprove, reason);

      if (!isApprove) {
        $page.functions.closeDialog('rejectDialog');
        $page.variables.rejectError = '';
      }

      if (!result) {
        $application.variables.messages = $application.functions.message(
          'warning',
          `${id} was already decided`,
          'The list has been refreshed.',
        );
      } else if (!isApprove) {
        $application.variables.messages = $application.functions.message(
          'info',
          `${id} rejected`,
          'The reason is on the request timeline for the requester.',
        );
      } else if (result.workOrder) {
        $application.variables.messages = $application.functions.message(
          'confirmation',
          `${id} fully approved`,
          `Work order ${result.workOrder.id} created for ${result.workOrder.technician}.`,
        );
      } else {
        $application.variables.messages = $application.functions.message(
          'confirmation',
          `${id} approved`,
          `Sent to the ${$application.functions.roleText(result.nextRole)} for the next approval.`,
        );
      }

      const counts = $application.functions.counts();
      $application.variables.counts = counts;
      $page.variables.items = $application.functions.inbox($page.variables.role);
      $page.variables.roleTabs = $page.functions.roleTabs($application.functions.roles(), counts, $page.variables.role);
    }
  }

  return decideChain;
});
