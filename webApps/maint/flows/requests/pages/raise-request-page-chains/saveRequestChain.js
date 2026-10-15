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
   * The template's primary action (spPrimaryAction). Validates and saves the request:
   * sent for approval when "Send for approval now" is on, otherwise kept as a draft.
   * Then shows a toast and opens the request on the Requests page.
   */
  class saveRequestChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $page.variables.errorText = '';
      if (!$page.functions.validate('requestValidation')) {
        $page.variables.errorText = 'Some fields need your attention.';
        return;
      }
      if ($page.variables.isSaving) {
        return;
      }

      const submit = $page.variables.form.sendNow !== false;
      $page.variables.isSaving = true;
      let request;
      try {
        // Sample data. Live version: POST /requests to ORDS, then POST /requests/{id}/submit.
        request = $application.functions.createRequest($page.variables.form, submit);
      } catch (error) {
        $page.variables.isSaving = false;
        $page.variables.errorText = error && error.message ? error.message : String(error);
        return;
      }

      $page.variables.isSaving = false;
      $application.variables.counts = $application.functions.counts();
      $application.variables.messages = submit
        ? $application.functions.message('confirmation', `${request.id} sent for approval`, `Waiting for ${request.waitingFor}.`)
        : $application.functions.message('confirmation', `${request.id} saved as a draft`, 'Send it for approval when you are ready.');

      // The Requests page opens this request's drawer.
      $application.variables.openRequestId = request.id;
      await Actions.navigateToPage(context, {
        page: 'my-requests',
      });
    }
  }

  return saveRequestChain;
});
