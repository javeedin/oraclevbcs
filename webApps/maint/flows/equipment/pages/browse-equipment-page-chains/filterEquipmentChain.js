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
   * Applies one filter change (search text as you type, a category chip,
   * the status buttons) or clears them all, then refreshes cards and table.
   */
  class filterEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]      raw text from the search box
     * @param {string} [params.category]  category chip key, 'All' for everything
     * @param {string} [params.status]    'all' | Running | Maintenance | Down
     * @param {boolean} [params.reset]    clear every filter
     */
    async run(context, { text, category, status, reset } = {}) {
      const { $page } = context;

      if (reset === true) {
        $page.variables.search = '';
        $page.variables.searchText = '';
        $page.variables.category = 'All';
        $page.variables.status = 'all';
      }
      if (typeof text === 'string') {
        $page.variables.searchText = text;
      } else if (text === null) {
        $page.variables.searchText = '';
      }
      if (category) {
        $page.variables.category = category;
      }
      if (status) {
        $page.variables.status = status;
      }

      const shown = $page.functions.filterList(
        $page.variables.all,
        $page.variables.searchText,
        $page.variables.category,
        $page.variables.status,
      );
      $page.variables.shown = shown;
      $page.variables.tableADP.data = shown;
      $page.variables.categoryChips = $page.functions.categoryChips($page.variables.all, $page.variables.category);
    }
  }

  return filterEquipmentChain;
});
