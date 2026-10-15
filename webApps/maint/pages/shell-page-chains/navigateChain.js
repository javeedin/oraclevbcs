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
   * Redwood in-app navigation (spSelectionAction) or a header link: shows that flow.
   * From the shell the flow is "below the current page", so no target is needed.
   * The navigation highlights the item itself because its selection is bound to $page.currentFlow.
   */
  class navigateChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.flow  home | dashboard | requests | equipment | inbox | workorders
     */
    async run(context, { flow } = {}) {
      if (!flow) {
        return;
      }

      await Actions.navigateToFlow(context, {
        flow,
      });
    }
  }

  return navigateChain;
});
