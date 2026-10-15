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

  /** Filters the waiting requests as you type in the search field. */
  class searchInboxChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]  raw text from the search field
     */
    async run(context, { text } = {}) {
      const { $page } = context;

      $page.variables.searchText = typeof text === 'string' ? text : '';
      $page.variables.items = $page.functions.filterItems($page.variables.allItems, $page.variables.searchText);
    }
  }

  return searchInboxChain;
});
