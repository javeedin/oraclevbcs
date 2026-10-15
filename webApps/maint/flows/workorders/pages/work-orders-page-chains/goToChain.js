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

  /**
   * Opens another module flow in the shell, e.g. from a tile or a link.
   * The target flow is a sibling of this page's flow, so target is 'parent'.
   */
  class goToChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.flow  dashboard | request | requests | approval | equipment | inbox | workorders
     */
    async run(context, { flow } = {}) {
      const { $application } = context;

      if (!flow) {
        return;
      }

      $application.variables.activeNav = flow;
      await Actions.navigateToFlow(context, {
        target: 'parent',
        flow,
      });
    }
  }

  return goToChain;
});
