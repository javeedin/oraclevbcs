define([], () => {
  'use strict';

  /** Raise request page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /**
     * Shows the messages of every invalid field in the validation group and moves focus to the first one.
     * @returns {boolean} true when the form can be saved
     */
    validate(groupId) {
      const group = document.getElementById(groupId);
      if (!group) {
        return true;
      }
      if (group.valid === 'valid') {
        return true;
      }
      group.showMessages();
      group.focusOn('@firstInvalidShown');
      return false;
    }

    priorityHelp(priority) {
      return (
        {
          Low: 'Can wait for the next planned visit.',
          Medium: 'Needs attention within a week.',
          High: 'Affects output or safety margins. Needs attention within 48 hours.',
          Critical: 'Production stopped or a safety risk. Also goes to the plant manager for approval.',
        }[priority] || ''
      );
    }
  }

  return PageModule;
});
