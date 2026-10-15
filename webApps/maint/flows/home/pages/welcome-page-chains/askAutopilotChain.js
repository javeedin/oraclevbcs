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
   * Opens the Auto Pilot panel (it lives in the shell). With a prompt, the shell sends it
   * as soon as the panel opens.
   */
  class askAutopilotChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.prompt]  question to ask straight away
     */
    async run(context, { prompt } = {}) {
      const { $application } = context;

      $application.variables.autopilotQueued = prompt || '';
      $application.variables.autopilotOpen = true;
    }
  }

  return askAutopilotChain;
});
