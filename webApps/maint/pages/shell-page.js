define([], () => {
  'use strict';

  let counter = 0;
  function nextId(prefix) {
    counter += 1;
    return `${prefix}${Date.now().toString(36)}${counter}`;
  }

  /** Shell page module: $functions.<name>() in shell HTML, $page.functions.<name>() in shell chains. */
  class PageModule {
    /* ---------- Auto Pilot chat messages ---------- */

    userMessage(text) {
      return { id: nextId('u'), role: 'user', text, blocks: [], tools: [], meta: '' };
    }

    /** An answer from Claude: blocks to render, what it looked up, and which model answered. */
    answerMessage(result) {
      const tokens = result.usage ? result.usage.input + result.usage.output : 0;
      return {
        id: nextId('a'),
        role: 'assistant',
        text: '',
        blocks: result.blocks || [],
        tools: result.tools || [],
        meta: `${result.modelLabel || ''}${tokens ? ` · ${tokens.toLocaleString('en-US')} tokens` : ''}`,
      };
    }

    /** A note or an error in the conversation (not sent to Claude). */
    noteMessage(blocks, role) {
      return { id: nextId('n'), role: role || 'note', text: '', blocks: blocks || [], tools: [], meta: '' };
    }

    /* ---------- DOM helpers ---------- */

    /** What is typed in a field right now, even before it is committed (Ctrl+Enter, button click). */
    rawText(id) {
      const field = document.getElementById(id);
      return field && typeof field.rawValue === 'string' ? field.rawValue : '';
    }

    /** Clears what is shown in a field once its value has been reset. */
    resetField(id) {
      const field = document.getElementById(id);
      if (field && typeof field.reset === 'function') {
        field.reset();
      }
    }

    scrollChat() {
      setTimeout(() => {
        const log = document.getElementById('mxApLog');
        if (log) {
          log.scrollTop = log.scrollHeight;
        }
      }, 60);
    }

    focusPrompt() {
      setTimeout(() => {
        const field = document.getElementById('apPrompt');
        if (field && typeof field.focus === 'function') {
          field.focus();
        }
      }, 150);
    }

    openDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog && typeof dialog.open === 'function') {
        dialog.open();
      }
    }

    closeDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    }
  }

  return PageModule;
});
