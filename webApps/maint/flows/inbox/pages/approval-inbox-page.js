define([], () => {
  'use strict';

  /** Approval inbox page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Role tabs with how many requests wait for each role. */
    roleTabs(roles, counts, selected) {
      const byRole = (counts && counts.inboxByRole) || {};
      return (roles || []).map((r) => ({
        id: r.id,
        role: r.role,
        name: r.name,
        count: byRole[r.id] || 0,
        selected: r.id === selected,
      }));
    }

    openDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog) {
        dialog.open();
      }
    }

    closeDialog(id) {
      const dialog = document.getElementById(id);
      if (dialog) {
        dialog.close();
      }
    }

    /** What is typed in a text field right now, even before it loses focus. */
    rawText(id) {
      const field = document.getElementById(id);
      return field && typeof field.rawValue === 'string' ? field.rawValue : '';
    }
  }

  return PageModule;
});
