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

  /** The Auto Pilot settings dialog: open, save, test the connection, remove the key, close. */
  class autopilotSettingsChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.action  open | save | test | remove | close
     */
    async run(context, { action } = {}) {
      const { $page, $application } = context;

      if (action === 'open') {
        $page.variables.apForm = $application.functions.autopilotForm();
        $page.variables.apSettings = $application.functions.autopilotSettings();
        $page.variables.apStatus = '';
        $page.functions.openDialog('apSettingsDialog');
        return;
      }
      if (action === 'close') {
        $page.functions.closeDialog('apSettingsDialog');
        return;
      }

      // The key may still be uncommitted in the password field (typed, then a button clicked).
      const form = Object.assign({}, $page.variables.apForm);
      const typed = $page.functions.rawText('apKeyField');
      if (typed) {
        form.apiKey = typed;
      }

      if (action === 'test') {
        $page.variables.apTesting = true;
        $page.variables.apStatus = '';
        const result = await $application.functions.testAutopilot(form);
        $page.variables.apStatusOk = result.ok === true;
        $page.variables.apStatus = result.message;
        $page.variables.apTesting = false;
        return;
      }

      if (action === 'remove') {
        $application.functions.removeAutopilotKey();
        $page.variables.apSettings = $application.functions.autopilotSettings();
        $page.variables.apForm = $application.functions.autopilotForm();
        $page.variables.apStatusOk = true;
        $page.variables.apStatus = 'The key was removed from this browser.';
        return;
      }

      if (action === 'save') {
        $application.functions.saveAutopilotSettings(form);
        const settings = $application.functions.autopilotSettings();
        $page.variables.apSettings = settings;
        $page.variables.apForm = $application.functions.autopilotForm();
        $page.functions.closeDialog('apSettingsDialog');
        $application.variables.messages = $application.functions.message(
          'confirmation',
          'Auto Pilot settings saved',
          settings.hasKey ? `Using ${settings.modelLabel}.` : 'Add a Claude API key to start using Auto Pilot.',
        );
      }
    }
  }

  return autopilotSettingsChain;
});
