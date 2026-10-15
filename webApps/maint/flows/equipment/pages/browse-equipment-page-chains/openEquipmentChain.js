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

  /** Opens the detail drawer for one asset, with its request history. */
  class openEquipmentChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id  equipment id, e.g. EQ-1005
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      if (!id) {
        return;
      }

      // Sample data. Live version: GET /equipment/{id} and GET /equipment/{id}/requests.
      $page.variables.selected = $application.functions.equipmentById(id) || {};
      $page.variables.history = $application.functions.equipmentRequests(id);
      $page.variables.detailOpen = true;
    }
  }

  return openEquipmentChain;
});
