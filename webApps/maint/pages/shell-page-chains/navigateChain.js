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
   * Menu click: shows the chosen flow in the shell's router.
   * From the shell the flow is "below the current page", so no target is needed.
   */
  class navigateChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.flow  dashboard | request | requests | approval | equipment | inbox | workorders
     */
    async run(context, { flow } = {}) {
      const { $page, $application } = context;

      if (!flow) {
        return;
      }

      // On small screens the menu overlays the page, so close it after a choice.
      if ($page.functions.isNarrow()) {
        $page.variables.navOpen = false;
      }

      $application.variables.activeNav = flow;
      await Actions.navigateToFlow(context, {
        flow,
      });
    }
  }

  return navigateChain;
});
