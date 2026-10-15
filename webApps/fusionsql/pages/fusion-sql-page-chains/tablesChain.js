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
   * Table browser in the side panel. It reads Fusion's data dictionary (ALL_OBJECTS,
   * ALL_TAB_COLUMNS) through the same BI Publisher report as any other query.
   */
  class tablesChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.action    search | describe | back | insert | column
     * @param {string} [params.text]    search text (from the search field's Enter)
     * @param {string} [params.owner]   owner of the table to describe
     * @param {string} [params.name]    table or view to describe
     * @param {string} [params.column]  column name to type into the editor
     */
    async run(context, { action, text, owner, name, column } = {}) {
      const { $page, $application } = context;

      if (action === 'back') {
        $page.variables.described = null;
        $page.variables.tablesNote = '';
        return;
      }

      if (action === 'insert') {
        const described = $page.variables.described;
        if (!described) {
          return;
        }
        // Add the SELECT below what is in the editor, with the cursor in it, ready for Ctrl+Enter.
        const text = $page.functions.editorText($page.variables.sql).trim();
        const prefix = text ? `${text.replace(/;?\s*$/, ';')}\n\n` : '';
        $page.variables.sql = prefix + $page.functions.selectFor(described);
        $page.functions.focusEditor(prefix.length);
        return;
      }

      if (action === 'column') {
        if (!column) {
          return;
        }
        const next = $page.functions.insertAtCursor(column, $page.variables.sql);
        $page.variables.sql = next.text;
        $page.functions.focusEditor(next.caret);
        return;
      }

      if ($page.variables.tablesBusy) {
        return;
      }

      if (action === 'search') {
        const term = typeof text === 'string' && text.trim() ? text : $page.functions.rawText('tableSearchField') || $page.variables.tableSearch;
        $page.variables.tableSearch = term || '';
        $page.variables.tablesBusy = true;
        $page.variables.tablesNote = '';
        try {
          const result = await $application.functions.runSql($application.functions.tablesSql(term), { maxRows: 200 });
          const list = $page.functions.tableList(result);
          $page.variables.tables = list;
          if (!list.length) {
            $page.variables.tablesNote = 'Nothing found. Try another part of the name, for example HEADERS.';
          } else if (result.truncated) {
            $page.variables.tablesNote = 'The first 200 matches. Type more of the name to narrow it.';
          } else {
            $page.variables.tablesNote = `${list.length} found. Click one to see its columns.`;
          }
        } catch (e) {
          $page.variables.tables = [];
          $page.variables.tablesNote = e && e.message ? e.message : String(e);
        } finally {
          $page.variables.tablesBusy = false;
        }
        return;
      }

      if (action === 'describe') {
        if (!name) {
          return;
        }
        $page.variables.tablesBusy = true;
        $page.variables.tablesNote = '';
        try {
          const result = await $application.functions.runSql($application.functions.columnsSql(owner, name), { maxRows: 1000 });
          const described = $page.functions.describedFrom(owner, name, result);
          $page.variables.described = described;
          $page.variables.claudeTables = $page.functions.rememberTable($page.variables.claudeTables, described);
          if (!described.columns.length) {
            $page.variables.tablesNote = 'No columns visible to the report user.';
          }
        } catch (e) {
          $page.variables.tablesNote = e && e.message ? e.message : String(e);
        } finally {
          $page.variables.tablesBusy = false;
        }
      }
    }
  }

  return tablesChain;
});
