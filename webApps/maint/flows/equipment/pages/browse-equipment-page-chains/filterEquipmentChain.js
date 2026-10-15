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
   * Applies one filter change (search text as you type, the category select,
   * the status buttons) or clears them all, then refreshes the cards and the table.
   */
  class filterEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]      raw text from the search field
     * @param {string} [params.category]  category, 'All' for everything
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

      const v = $page.variables;
      const shown = $page.functions.filterList(v.all, v.searchText, v.category, v.status);
      $page.variables.shown = shown;
      $page.variables.tableADP.data = shown;
      $page.variables.shownCount = shown.length;
    }
  }

  return filterEquipmentChain;
});
