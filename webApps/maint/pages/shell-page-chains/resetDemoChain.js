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

  /** "Reset sample data": reseeds the store and reloads the app on the dashboard. */
  class resetDemoChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $application } = context;

      $application.functions.resetDemo();
      $application.variables.counts = $application.functions.counts();
      $application.variables.activeNav = 'dashboard';

      // A full reload is the simplest way to make every page re-read the store.
      window.location.reload();
    }
  }

  return resetDemoChain;
});
