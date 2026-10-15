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
   * Header "Download desktop app": downloads the Windows installer from the latest GitHub release
   * (built by .github/workflows/desktop.yml), or opens the releases page on other systems.
   */
  class downloadDesktopChain extends ActionChain {

    /**
     * @param {Object} context
     */
    async run(context) {
      const { $page, $application } = context;

      const download = $application.functions.desktopDownload();
      $page.functions.openUrl(download.url);
      $application.variables.messages = download.isWindows
        ? $application.functions.message(
          'info',
          `Downloading ${download.file}`,
          'Run it to install Maintenance for your Windows account (no admin rights needed). If SmartScreen says "Windows protected your PC", choose More info, then Run anyway: the installer is not code-signed yet.',
          15000,
        )
        : $application.functions.message(
          'info',
          'Desktop app downloads',
          'The desktop app is built for Windows. The releases page lists the installer and what changed in each version.',
          8000,
        );
    }
  }

  return downloadDesktopChain;
});
