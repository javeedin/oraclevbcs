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
   * Keeps the side panel in step with the form: the selected equipment card
   * and the approval route. The changed field arrives as a parameter because
   * the value-changed event can run before the two-way binding writes back.
   */
  class previewChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.field  equipmentId | type | priority | estCost
     * @param {*} params.value
     */
    async run(context, { field, value } = {}) {
      const { $page, $application } = context;

      const form = Object.assign({}, $page.variables.form);
      if (field) {
        form[field] = value;
      }

      if (field === 'equipmentId' || !field) {
        $page.variables.equipment = form.equipmentId ? $application.functions.equipmentById(form.equipmentId) || {} : {};
      }
      $page.variables.route = $application.functions.routePreview(form.priority, form.type, form.estCost);
    }
  }

  return previewChain;
});
