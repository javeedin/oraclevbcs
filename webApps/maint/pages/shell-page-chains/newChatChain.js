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

  /** "New chat": forgets the conversation (the settings stay). */
  class newChatChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page } = context;

      if ($page.variables.apBusy) {
        return;
      }
      $page.variables.apChat = [];
      $page.variables.apHistory = [];
      $page.functions.focusPrompt();
    }
  }

  return newChatChain;
});
