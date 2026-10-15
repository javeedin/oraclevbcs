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

  /** Loads the equipment list when the page opens and applies the current filters. */
  class loadEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /equipment from ORDS (same fields).
      const all = $application.functions.equipmentList();
      $page.variables.all = all;
      const stats = $page.functions.stats(all);
      $page.variables.stats = stats;
      $page.variables.subtitle = $page.functions.subtitle(stats);
      $page.variables.categoryOptionsADP.data = $page.functions.categoryOptions(all);

      const v = $page.variables;
      const shown = $page.functions.filterList(all, v.searchText, v.category, v.status);
      $page.variables.shown = shown;
      $page.variables.tableADP.data = shown;
      $page.variables.shownCount = shown.length;
    }
  }

  return loadEquipmentChain;
});
