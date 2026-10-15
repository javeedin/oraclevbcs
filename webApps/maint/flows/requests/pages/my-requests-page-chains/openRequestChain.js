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

  /** Opens the detail drawer for one request. */
  class openRequestChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id  request id, e.g. MR-24136
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      if (!id) {
        return;
      }

      // Sample data. Live version: GET /requests/{id} (with route and history) from ORDS.
      const request = $application.functions.requestById(id);
      if (request) {
        $page.variables.selected = request;
        $page.variables.detailOpen = true;
      }
    }
  }

  return openRequestChain;
});
