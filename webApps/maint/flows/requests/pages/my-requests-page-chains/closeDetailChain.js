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

  /** Closes the detail drawer. */
  class closeDetailChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page } = context;

      $page.variables.detailOpen = false;
    }
  }

  return closeDetailChain;
});
