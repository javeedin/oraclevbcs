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

  /** Opens another page of the Requests flow: raise-request or send-approval. */
  class openPageChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.page  raise-request | send-approval | my-requests
     */
    async run(context, { page } = {}) {
      if (!page) {
        return;
      }

      await Actions.navigateToPage(context, {
        page,
      });
    }
  }

  return openPageChain;
});
