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

  /** Builds the welcome banner text and the three card lists every time Home opens. */
  class loadHomeChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /maintenance/dashboard from ORDS.
      const model = $application.functions.dashboard();
      const counts = $application.functions.counts();
      $application.variables.counts = counts;

      $page.variables.pageTitle = `${$application.functions.greeting()}, Demo user`;
      $page.variables.overline = $application.functions.longToday();
      $page.variables.summary = $page.functions.summaryLine(model);

      const attention = $page.functions.attentionCards(model.attention);
      $page.variables.attentionCount = attention.length;
      $page.variables.attentionADP.data = attention;
      $page.variables.shortcutsADP.data = $page.functions.shortcuts(counts);
      $page.variables.recentADP.data = $page.functions.requestCards(model.recent.slice(0, 3));
    }
  }

  return loadHomeChain;
});
