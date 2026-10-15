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

  /** Cancel in the reject dialog. */
  class closeRejectChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page } = context;

      $page.functions.closeDialog('rejectDialog');
      $page.variables.rejectError = '';
    }
  }

  return closeRejectChain;
});
