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

  /** Copies the rows shown (tab-separated, for Excel) or downloads them as CSV. */
  class exportChain extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.format  csv | tsv
     */
    async run(context, { format } = {}) {
      const { $page, $application } = context;

      const cols = $page.variables.resultCols;
      const rows = $page.functions.filterRows($page.variables.resultRows, cols, $page.variables.filterText);
      if (!rows.length) {
        return;
      }

      if (format === 'csv') {
        $page.functions.download($page.functions.fileName('csv'), $page.functions.toDelimited(cols, rows, ','));
        return;
      }

      const ok = await $page.functions.copyText($page.functions.toDelimited(cols, rows, '\t'));
      $page.variables.messages = ok
        ? $application.functions.message('confirmation', `Copied ${rows.length.toLocaleString('en-US')} rows`, 'Paste them into Excel or a sheet.')
        : $application.functions.message('warning', 'Could not copy', 'The browser blocked the clipboard. Use CSV instead.');
    }
  }

  return exportChain;
});
