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
   * "Raise request": opens the Raise request page of the Requests flow,
   * with the asset already chosen when one is given.
   */
  class raiseForEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.id]  equipment id
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      $page.variables.detailOpen = false;
      $application.variables.prefillEquipmentId = id || '';

      await Actions.navigateToFlow(context, {
        target: 'parent',
        flow: 'requests',
        page: 'raise-request',
      });
    }
  }

  return raiseForEquipmentChain;
});
