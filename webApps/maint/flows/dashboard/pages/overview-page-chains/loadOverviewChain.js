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

  /** Builds the dashboard every time the page opens. */
  class loadOverviewChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      $application.variables.activeNav = 'dashboard';

      // Sample data. Live version: one ORDS GET returning the same model.
      const model = $application.functions.dashboard();

      $page.variables.model = model;
      $page.variables.statusADP.data = model.statusPoints;
      $page.variables.weeklyADP.data = model.weeklyPoints;
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadOverviewChain;
});
