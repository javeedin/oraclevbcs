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

  /** Runs once when the app opens: badge counts, and a closed menu on small screens. */
  class initShellChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.counts = $application.functions.counts();

      if ($page.functions.isNarrow()) {
        $page.variables.navOpen = false;
      }
    }
  }

  return initShellChain;
});
