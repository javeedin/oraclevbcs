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

  /** Opens History or Tables in the side panel; the same button again closes it. */
  class panelChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.panel  history | tables | '' (close)
     */
    async run(context, { panel } = {}) {
      const { $page, $application } = context;

      const next = panel && $page.variables.panel !== panel ? panel : '';
      if (next === 'history') {
        $page.variables.history = $application.functions.history();
      }
      $page.variables.panel = next;
    }
  }

  return panelChain;
});
