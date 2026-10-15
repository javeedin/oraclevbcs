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

  /** Builds the banner text, the counters and the lists every time Home opens. */
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
      $page.variables.tiles = $page.functions.tiles(counts, model);
      $page.variables.attention = $page.functions.attentionRows(model.attention);
      $page.variables.recent = model.recent.slice(0, 5);
      $page.variables.askChips = $application.functions.autopilotSuggestions().slice(0, 3);
    }
  }

  return loadHomeChain;
});
