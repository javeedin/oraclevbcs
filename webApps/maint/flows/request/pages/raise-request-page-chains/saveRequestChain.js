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
   * "Save as draft" (submit = false) or "Submit for approval" (submit = true).
   * Validates, saves, shows a toast and opens the next useful page.
   */
  class saveRequestChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {boolean} params.submit
     */
    async run(context, { submit } = {}) {
      const { $page, $application } = context;

      $page.variables.errorText = '';
      if (!$page.functions.validate('requestValidation')) {
        $page.variables.errorText = 'Some fields need your attention.';
        return;
      }

      $page.variables.isSaving = true;
      let request;
      try {
        // Sample data. Live version: POST /requests to ORDS, then POST /requests/{id}/submit.
        request = $application.functions.createRequest($page.variables.form, submit === true);
      } catch (error) {
        $page.variables.isSaving = false;
        $page.variables.errorText = error && error.message ? error.message : String(error);
        return;
      }

      $application.variables.counts = $application.functions.counts();
      $application.variables.messages = submit === true
        ? $application.functions.message('confirmation', `${request.id} sent for approval`, `Waiting for ${request.waitingFor}.`)
        : $application.functions.message('confirmation', `${request.id} saved as a draft`, 'Send it for approval when you are ready.');

      const flow = submit === true ? 'requests' : 'approval';
      $application.variables.activeNav = flow;
      await Actions.navigateToFlow(context, {
        target: 'parent',
        flow,
      });
    }
  }

  return saveRequestChain;
});
