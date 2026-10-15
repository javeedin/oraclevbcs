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

      // Sample data. Live version: GET /work-orders from ORDS.
      const list = $application.functions.workOrderList();
      $page.variables.all = list;
      const stats = $page.functions.stats(list);
      $page.variables.stats = stats;
      $page.variables.subtitle = $page.functions.subtitle(stats);
      $page.variables.board = $page.functions.board($page.functions.filterList(list, $page.variables.searchText));
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadWorkOrdersChain;
});
