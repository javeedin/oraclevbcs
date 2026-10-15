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

  /** Runs once when the app opens: the counts shown in the header. */
  class initShellChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      $application.variables.counts = $application.functions.counts();
    }
  }

  return initShellChain;
});
