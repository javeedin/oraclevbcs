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

  /** Header "Auto Pilot" button and the panel's Close button. */
  class toggleAutopilotChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {boolean} params.open
     */
    async run(context, { open } = {}) {
      const { $application } = context;

      $application.variables.autopilotOpen = open === true;
    }
  }

  return toggleAutopilotChain;
});
