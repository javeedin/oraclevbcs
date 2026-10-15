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
   * Claude writes a query from a sentence (mode "write"), or fixes the statement that just
   * failed using its error (mode "fix"). It only changes the editor; it never runs anything.
   * The columns of the tables opened in the Tables panel go along as context.
   */
  class askChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.mode      write | fix
     * @param {string} [params.key]     key pressed in the question field
     * @param {boolean} [params.shift]  Shift held
     */
    async run(context, { mode, key, shift } = {}) {
      const { $page, $application } = context;

      if (key !== undefined && !(key === 'Enter' && shift !== true)) {
        return;
      }
      if ($page.variables.askBusy) {
        return;
      }

      const claude = $application.functions.claudeSettings();
      $page.variables.claude = claude;
      if (!claude.hasKey) {
        $page.variables.settingsForm = $application.functions.settingsForm();
        $page.variables.claudeForm = $application.functions.claudeForm();
        $page.variables.settingsOk = false;
        $page.variables.settingsStatus = 'Add a Claude API key under "Claude" to let Claude write and fix queries.';
        $page.functions.openDialog('settingsDialog');
        return;
      }

      let request;
      if (mode === 'fix') {
        const error = $page.variables.error;
        if (!error.show || !error.sql) {
          return;
        }
        request = { mode: 'fix', sql: error.sql, error: error.message, tables: $page.variables.claudeTables };
      } else {
        const question = ($page.functions.rawText('askField') || $page.variables.ask || '').trim();
        if (!question) {
          $page.variables.askNote = 'Describe the data you want, then press Write SQL.';
          return;
        }
        $page.variables.ask = question;
        request = {
          mode: 'write',
          question,
          sql: $page.functions.currentStatement($page.variables.sql).sql,
          tables: $page.variables.claudeTables,
        };
      }

      $page.variables.askBusy = true;
      $page.variables.askNote = '';
      try {
        const answer = await $application.functions.askClaude(request);
        const text = $page.functions.editorText($page.variables.sql);
        let caret = 0;
        if (mode === 'fix') {
          $page.variables.sql = $page.functions.replaceStatement(text, request.sql, answer.sql);
          caret = Math.max(0, $page.variables.sql.indexOf(answer.sql));
          $page.variables.error = { show: false, message: '', sql: '' };
        } else if (!text.trim()) {
          $page.variables.sql = answer.sql;
        } else {
          // Keep what is in the editor and add Claude's query below it, ready for Ctrl+Enter.
          const before = `${text.trim().replace(/;?\s*$/, ';')}\n\n`;
          $page.variables.sql = before + answer.sql;
          caret = before.length;
        }
        $page.variables.askNote = answer.note
          ? `Claude: ${answer.note}`
          : 'Claude wrote the query. Check it, then press Run (or Ctrl+Enter with the cursor in it).';
        $page.functions.focusEditor(caret);
      } catch (e) {
        $page.variables.askNote = e && e.message ? e.message : String(e);
      } finally {
        $page.variables.askBusy = false;
      }
    }
  }

  return askChain;
});
