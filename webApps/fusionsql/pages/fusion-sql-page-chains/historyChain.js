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

  /** History: load a past query into the editor, or clear the list. ("Run again" goes to runChain.) */
  class historyChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.action  load | clear
     * @param {string} [params.id]    history entry
     */
    async run(context, { action, id } = {}) {
      const { $page, $application } = context;

      if (action === 'clear') {
        $page.variables.history = $application.functions.clearHistory();
        return;
      }
      if (action === 'load') {
        const entry = $page.variables.history.find((h) => h.id === id);
        if (entry) {
          $page.variables.sql = entry.sql;
          $page.functions.focusEditor(entry.sql.length);
        }
      }
    }
  }

  return historyChain;
});
