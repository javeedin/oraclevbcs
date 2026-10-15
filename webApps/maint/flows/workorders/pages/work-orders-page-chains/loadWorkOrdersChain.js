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

  /** Builds the board when the page opens. */
  class loadWorkOrdersChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.activeNav = 'workorders';

      // Sample data. Live version: GET /work-orders from ORDS.
      const list = $application.functions.workOrderList();
      $page.variables.board = $page.functions.board(list);
      $page.variables.stats = $page.functions.stats(list);
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadWorkOrdersChain;
});
