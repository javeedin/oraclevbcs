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

  /** Hamburger button: slides the menu in or out. */
  class toggleNavChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page } = context;

      $page.variables.navOpen = !$page.variables.navOpen;
    }
  }

  return toggleNavChain;
});
