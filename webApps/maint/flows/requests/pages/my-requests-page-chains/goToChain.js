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
   * Opens another module flow in the shell (optionally a given page of it, or one request).
   * The target flow is a sibling of this page's flow, so target is 'parent'.
   */
  class goToChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.flow          home | dashboard | requests | equipment | inbox | workorders
     * @param {string} [params.page]        a page of that flow, e.g. raise-request; empty for its default page
     * @param {string} [params.requestId]   open this request on the Requests page
     * @param {string} [params.view]        with requestId: details (default) or workflow
     */
    async run(context, { flow, page, requestId, view } = {}) {
      const { $application } = context;

      if (!flow) {
        return;
      }

      if (requestId) {
        $application.variables.openRequestId = requestId;
        $application.variables.openRequestView = view === 'workflow' ? 'workflow' : '';
      }

      const options = { target: 'parent', flow };
      if (page) {
        options.page = page;
      }
      await Actions.navigateToFlow(context, options);
    }
  }

  return goToChain;
});
