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

  /** Runs once when the app opens: header counts and the Auto Pilot state. */
  class initShellChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.counts = $application.functions.counts();
      $page.variables.apSettings = $application.functions.autopilotSettings();
      $page.variables.apSuggestions = $application.functions.autopilotSuggestions();
      $page.variables.apModelsADP.data = $application.functions.autopilotModels();
    }
  }

  return initShellChain;
});
