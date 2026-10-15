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

  /** Runs once when the page opens: settings, history, examples and the last draft. */
  class initPageChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      const settings = $application.functions.settings();
      $page.variables.connection = $application.functions.connectionLabel(settings);
      $page.variables.maxRows = settings.maxRows;
      $page.variables.history = $application.functions.history();
      $page.variables.starters = $page.functions.starters();
      $page.variables.claude = $application.functions.claudeSettings();
      $page.variables.modelsADP.data = $application.functions.claudeModels();

      const draft = $application.functions.draft();
      $page.variables.sql = draft || $page.functions.starterSql('check');
    }
  }

  return initPageChain;
});
