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
   * Runs SQL on Fusion through the BI Publisher report. Called from:
   *  - the Run button (no parameters): the selection, or the statement at the cursor;
   *  - the editor's keydown (key, ctrl): the same, on Ctrl+Enter only;
   *  - "Run again" in History (sql, load): that statement, after putting it in the editor.
   */
  class runChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.key]    key pressed in the editor
     * @param {boolean} [params.ctrl]  Ctrl or Cmd held
     * @param {string} [params.sql]    statement to run instead of the editor's
     * @param {boolean} [params.load]  also put that statement in the editor
     */
    async run(context, { key, ctrl, sql, load } = {}) {
      const { $page, $application } = context;

      if (key !== undefined && !(key === 'Enter' && ctrl === true)) {
        return;
      }
      if ($page.variables.running) {
        return;
      }

      let pick;
      if (typeof sql === 'string' && sql.trim()) {
        pick = { sql: sql.trim(), scope: 'all' };
        if (load === true) {
          $page.variables.sql = pick.sql;
        }
      } else {
        pick = $page.functions.currentStatement($page.variables.sql);
        $application.functions.saveDraft($page.functions.editorText($page.variables.sql));
      }
      if (!pick.sql) {
        $page.variables.error = { show: true, message: 'Type a SELECT statement first.', sql: '' };
        return;
      }

      $page.variables.running = true;
      $page.variables.error = { show: false, message: '', sql: '' };
      $page.variables.askNote = '';
      try {
        const result = await $application.functions.runSql(pick.sql);
        $page.variables.resultCols = result.columns;
        $page.variables.resultRows = result.rows;
        $page.variables.filterText = '';
        $page.variables.columns = $page.functions.tableColumns(result.columns);
        $page.variables.tableADP = $page.functions.makeADP(result.rows, result.columns);
        $page.variables.result = $page.functions.resultInfo(result, pick.scope, result.rows.length);
        $page.variables.history = $application.functions.addHistory({
          sql: pick.sql,
          ok: true,
          rows: result.rows.length,
          ms: result.ms,
        });
      } catch (e) {
        const message = e && e.message ? e.message : String(e);
        $page.variables.error = { show: true, message, sql: pick.sql };
        $page.variables.history = $application.functions.addHistory({ sql: pick.sql, ok: false, error: message });
      } finally {
        $page.variables.running = false;
      }
    }
  }

  return runChain;
});
