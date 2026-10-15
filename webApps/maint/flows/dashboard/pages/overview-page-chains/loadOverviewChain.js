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

  /** Builds the scoreboard and every panel each time the dashboard opens. */
  class loadOverviewChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /maintenance/dashboard from ORDS, returning the same model.
      const model = $application.functions.dashboard();
      $page.variables.model = model;
      $page.variables.subtitle = $page.functions.subtitle(model);

      $page.variables.statusADP.data = model.statusPoints;
      $page.variables.weeklyADP.data = model.weeklyPoints;
      $page.variables.approverADP.data = model.approverPoints;
      $page.variables.healthADP.data = model.healthPoints;
      $page.variables.woADP.data = model.woPoints;

      // Scoreboard items: id, title, metric, meta. Set last, so the panels have data when it renders.
      $page.variables.kpis = model.kpis;
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadOverviewChain;
});
