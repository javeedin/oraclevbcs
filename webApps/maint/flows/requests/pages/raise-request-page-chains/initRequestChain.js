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
   * Fills the dropdowns and, when the user came from an equipment card,
   * preselects that asset ($application.variables.prefillEquipmentId).
   */
  class initRequestChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /equipment?fields=id,name from ORDS.
      $page.variables.equipmentADP.data = $application.functions.equipmentOptions();
      $page.variables.typeADP.data = $application.functions.typeOptions();
      $page.variables.minDate = $application.functions.todayIso();

      const prefill = $application.variables.prefillEquipmentId;
      if (prefill) {
        $page.variables.form = Object.assign({}, $page.variables.form, { equipmentId: prefill });
        $application.variables.prefillEquipmentId = '';
      }

      const form = $page.variables.form;
      $page.variables.equipment = form.equipmentId ? $application.functions.equipmentById(form.equipmentId) || {} : {};
      $page.variables.route = $application.functions.routePreview(form.priority, form.type, form.estCost);
    }
  }

  return initRequestChain;
});
