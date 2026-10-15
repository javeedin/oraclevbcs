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

  /** Ticks or unticks one draft. */
  class toggleDraftChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.id
     */
    async run(context, { id } = {}) {
      const { $page } = context;

      const ids = $page.functions.toggle($page.variables.selectedIds, id);
      $page.variables.selectedIds = ids;
      $page.variables.drafts = $page.functions.decorate($page.variables.drafts, ids);
      $page.variables.approvers = $page.functions.approvers($page.variables.drafts, ids);
    }
  }

  return toggleDraftChain;
});
