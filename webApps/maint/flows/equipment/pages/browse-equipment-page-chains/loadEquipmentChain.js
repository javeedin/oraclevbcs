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

  /** Loads the equipment list when the page opens. */
  class loadEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.activeNav = 'equipment';

      // Sample data. Live version: GET /equipment from ORDS (same fields).
      const all = $application.functions.equipmentList();
      $page.variables.all = all;
      $page.variables.stats = $page.functions.stats(all);

      const shown = $page.functions.filterList(all, $page.variables.searchText, $page.variables.category, $page.variables.status);
      $page.variables.shown = shown;
      $page.variables.tableADP.data = shown;
      $page.variables.categoryChips = $page.functions.categoryChips(all, $page.variables.category);
    }
  }

  return loadEquipmentChain;
});
