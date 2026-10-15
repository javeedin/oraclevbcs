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

  /** Editor actions: add an example query, clear the editor, change the row limit. */
  class editorChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.action   starter | clear | maxRows
     * @param {string} [params.id]     example query id
     * @param {number} [params.value]  new row limit
     */
    async run(context, { action, id, value } = {}) {
      const { $page, $application } = context;

      if (action === 'starter') {
        const sql = $page.functions.starterSql(id);
        if (!sql) {
          return;
        }
        const text = $page.functions.editorText($page.variables.sql).trim();
        const before = text ? `${text.replace(/;?\s*$/, ';')}\n\n` : '';
        $page.variables.sql = before + sql;
        $page.functions.focusEditor(before.length);
        return;
      }

      if (action === 'clear') {
        $page.variables.sql = '';
        $page.variables.error = { show: false, message: '', sql: '' };
        $page.variables.askNote = '';
        $application.functions.saveDraft('');
        $page.functions.focusEditor(0);
        return;
      }

      if (action === 'maxRows') {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) {
          return;
        }
        const saved = $application.functions.setMaxRows(n);
        if (saved !== $page.variables.maxRows) {
          $page.variables.maxRows = saved;
        }
      }
    }
  }

  return editorChain;
});
