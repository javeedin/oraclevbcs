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

  /** Opens the reject dialog for one request. */
  class openRejectChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.title
     */
    async run(context, { id, title } = {}) {
      const { $page } = context;

      $page.variables.rejectId = id;
      $page.variables.rejectTitle = title || '';
      $page.variables.rejectComment = '';
      $page.variables.rejectError = '';
      $page.functions.openDialog('rejectDialog');
    }
  }

  return openRejectChain;
});
