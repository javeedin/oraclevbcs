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

  /** Filters the rows already fetched as you type; nothing goes back to Fusion. */
  class filterChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]  raw text from the filter field
     */
    async run(context, { text } = {}) {
      const { $page } = context;

      const rows = $page.functions.filterRows($page.variables.resultRows, $page.variables.resultCols, text);
      $page.variables.tableADP = $page.functions.makeADP(rows, $page.variables.resultCols);
      $page.variables.result = $page.functions.withFilterInfo($page.variables.result, rows.length);
    }
  }

  return filterChain;
});
