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

  /** Loads the drafts with their approval route preview. All drafts start selected. */
  class loadDraftsChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      // Sample data. Live version: GET /requests?status=Draft&requestedBy=me from ORDS.
      const drafts = $application.functions.drafts();
      const ids = drafts.map((d) => d.id);

      $page.variables.selectedIds = ids;
      $page.variables.drafts = $page.functions.decorate(drafts, ids);
      $page.variables.approvers = $page.functions.approvers(drafts, ids);
      $application.variables.counts = $application.functions.counts();
    }
  }

  return loadDraftsChain;
});
