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

  /** "Raise request" on an asset: opens the request form with that asset already chosen. */
  class raiseForEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id  equipment id
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      $page.variables.detailOpen = false;
      $application.variables.prefillEquipmentId = id || '';
      $application.variables.activeNav = 'request';

      await Actions.navigateToFlow(context, {
        target: 'parent',
        flow: 'request',
      });
    }
  }

  return raiseForEquipmentChain;
});
