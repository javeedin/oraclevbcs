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

  /** The Settings dialog: open, test the connection, test Claude, remove the key, reset, save, close. */
  class settingsChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.action  open | test | testClaude | removeKey | reset | save | close
     */
    async run(context, { action } = {}) {
      const { $page, $application } = context;

      if (action === 'open') {
        $page.variables.settingsForm = $application.functions.settingsForm();
        $page.variables.claudeForm = $application.functions.claudeForm();
        $page.variables.claude = $application.functions.claudeSettings();
        $page.variables.settingsStatus = '';
        $page.functions.openDialog('settingsDialog');
        return;
      }
      if (action === 'close') {
        $page.functions.closeDialog('settingsDialog');
        return;
      }

      const form = Object.assign({}, $page.variables.settingsForm);
      const claudeForm = Object.assign({}, $page.variables.claudeForm);
      // The key may still be uncommitted in the password field (typed, then a button clicked).
      const typedKey = $page.functions.rawText('claudeKeyField');
      if (typedKey) {
        claudeForm.apiKey = typedKey;
      }

      if (action === 'test') {
        $page.variables.testing = true;
        $page.variables.settingsStatus = '';
        try {
          const result = await $application.functions.runSql(
            "SELECT 'OK' AS status, TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS server_time FROM dual",
            form,
          );
          const row = $page.functions.rowsAsObjects(result)[0] || {};
          $page.variables.settingsOk = row.STATUS === 'OK';
          $page.variables.settingsStatus =
            row.STATUS === 'OK'
              ? `Connected. BI Publisher ran the report in ${result.ms} ms (Fusion server time ${row.SERVER_TIME}).`
              : 'BI Publisher answered, but not with the expected row. Check that the report path points to the Fusion SQL report.';
        } catch (e) {
          $page.variables.settingsOk = false;
          $page.variables.settingsStatus = e && e.message ? e.message : String(e);
        } finally {
          $page.variables.testing = false;
        }
        return;
      }

      if (action === 'testClaude') {
        $page.variables.testing = true;
        $page.variables.settingsStatus = '';
        const result = await $application.functions.testClaude(claudeForm);
        $page.variables.settingsOk = result.ok === true;
        $page.variables.settingsStatus = result.message;
        $page.variables.testing = false;
        return;
      }

      if (action === 'removeKey') {
        $page.variables.claude = $application.functions.removeClaudeKey();
        $page.variables.claudeForm = $application.functions.claudeForm();
        $page.variables.settingsOk = true;
        $page.variables.settingsStatus = 'The Claude key was removed from this browser.';
        return;
      }

      if (action === 'reset') {
        const settings = $application.functions.resetSettings();
        $page.variables.settingsForm = $application.functions.settingsForm();
        $page.variables.connection = $application.functions.connectionLabel(settings);
        $page.variables.maxRows = settings.maxRows;
        $page.variables.settingsOk = true;
        $page.variables.settingsStatus = 'The connection settings are back to their defaults.';
        return;
      }

      if (action === 'save') {
        const settings = $application.functions.saveSettings(form);
        $page.variables.claude = $application.functions.saveClaude(claudeForm);
        $page.variables.claudeForm = $application.functions.claudeForm();
        $page.variables.connection = $application.functions.connectionLabel(settings);
        $page.variables.maxRows = settings.maxRows;
        $page.functions.closeDialog('settingsDialog');
        $page.variables.messages = $application.functions.message('confirmation', 'Settings saved', $page.variables.connection);
      }
    }
  }

  return settingsChain;
});
