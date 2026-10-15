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
   * Sends a question to Auto Pilot (Claude). Called from:
   *  - the Send button (no parameters): sends what is typed;
   *  - the prompt's keydown (key, ctrl): sends on Ctrl+Enter, ignores other keys;
   *  - a suggestion (text);
   *  - the panel opening (opened): sends a question another page queued in
   *    $application.variables.autopilotQueued (Home's "Ask Auto Pilot").
   */
  class autopilotSendChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} [params.text]      question to send instead of the typed one
     * @param {string} [params.key]       key pressed in the prompt
     * @param {boolean} [params.ctrl]     Ctrl or Cmd held
     * @param {boolean} [params.opened]   the panel's new opened state
     */
    async run(context, { text, key, ctrl, opened } = {}) {
      const { $page, $application } = context;

      let prompt = typeof text === 'string' ? text : '';
      if (opened !== undefined) {
        if (opened !== true) {
          return;
        }
        $page.variables.apSettings = $application.functions.autopilotSettings();
        $page.functions.focusPrompt();
        prompt = $application.variables.autopilotQueued || '';
        $application.variables.autopilotQueued = '';
        if (!prompt) {
          return;
        }
      } else if (key !== undefined && !(key === 'Enter' && ctrl === true)) {
        return;
      }
      if ($page.variables.apBusy) {
        return;
      }
      if (!prompt) {
        prompt = $page.functions.rawText('apPrompt') || $page.variables.apPrompt || '';
      }
      prompt = prompt.trim();
      if (!prompt) {
        return;
      }

      const settings = $application.functions.autopilotSettings();
      $page.variables.apSettings = settings;
      const chat = $page.variables.apChat.slice();
      chat.push($page.functions.userMessage(prompt));
      $page.variables.apPrompt = '';
      $page.functions.resetField('apPrompt');

      if (!settings.hasKey) {
        chat.push($page.functions.noteMessage($application.functions.autopilotBlocks('To answer, Auto Pilot needs your **Claude API key**. Add it in **Settings**, then ask again.'), 'note'));
        $page.variables.apChat = chat;
        $page.variables.apForm = $application.functions.autopilotForm();
        $page.variables.apStatus = '';
        $page.functions.openDialog('apSettingsDialog');
        return;
      }

      $page.variables.apChat = chat;
      $page.variables.apBusy = true;
      $page.functions.scrollChat();
      try {
        // Claude Messages API, with tools over the store in app-flow.js.
        const result = await $application.functions.askAutopilot($page.variables.apHistory, prompt);
        $page.variables.apHistory = result.history;
        $page.variables.apChat = $page.variables.apChat.concat([$page.functions.answerMessage(result)]);
        if (result.changed) {
          $application.variables.counts = $application.functions.counts();
          $application.variables.messages = $application.functions.message(
            'confirmation',
            'Auto Pilot saved a draft request',
            'You can review it and send it for approval from Requests.',
          );
        }
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        $page.variables.apChat = $page.variables.apChat.concat([
          $page.functions.noteMessage($application.functions.autopilotBlocks(`**Auto Pilot could not answer.** ${reason}`), 'error'),
        ]);
      } finally {
        $page.variables.apBusy = false;
        $page.functions.scrollChat();
      }
    }
  }

  return autopilotSendChain;
});
