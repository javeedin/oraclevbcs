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

  /** "Start work" (Scheduled to In progress) or "Mark complete" (In progress to Completed). */
  class advanceChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id  work order id
     */
    async run(context, { id } = {}) {
      const { $page, $application } = context;

      // Sample data. Live version: PATCH /work-orders/{id} with the new status to ORDS.
      const wo = $application.functions.advanceWorkOrder(id);
      if (wo) {
        $application.variables.messages = wo.status === 'Completed'
          ? $application.functions.message('confirmation', `${wo.id} completed`, `${wo.equipmentName} is back in service.`)
          : $application.functions.message('info', `${wo.id} started`, `${wo.technician} is working on ${wo.equipmentName}.`);
      }

      const list = $application.functions.workOrderList();
      $page.variables.board = $page.functions.board(list);
      $page.variables.stats = $page.functions.stats(list);
      $application.variables.counts = $application.functions.counts();
    }
  }

  return advanceChain;
});
