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

  /** "Select all" / "Clear selection". */
  class toggleAllChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page } = context;

      const drafts = $page.variables.drafts;
      const allSelected = $page.variables.selectedIds.length === drafts.length;
      const ids = allSelected ? [] : drafts.map((d) => d.id);

      $page.variables.selectedIds = ids;
      $page.variables.drafts = $page.functions.decorate(drafts, ids);
      $page.variables.approvers = $page.functions.approvers(drafts, ids);
    }
  }

  return toggleAllChain;
});
