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

  /** Filters the board as you type in the search field. */
  class searchWorkOrdersChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]  raw text from the search field
     */
    async run(context, { text } = {}) {
      const { $page } = context;

      $page.variables.searchText = typeof text === 'string' ? text : '';
      $page.variables.board = $page.functions.board($page.functions.filterList($page.variables.all, $page.variables.searchText));
    }
  }

  return searchWorkOrdersChain;
});
