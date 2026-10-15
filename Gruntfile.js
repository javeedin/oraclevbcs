'use strict';

/**
 * Visual Builder build script.
 * Tasks come from @oracle/grunt-vb-build and @oracle/grunt-vb-audit (see package.json).
 *
 *   grunt vb-process-local            validate + process sources into build/processed
 *   grunt vb-serve:webApps/maint --port=8888 --open
 *                                     serve the processed app locally
 *   grunt vb-audit                    Oracle's audit rules (JET + VB best practices)
 *   grunt vb-package                  optimise + create the deployable archive
 *
 * Optional: add --local to vb-process-local to resolve the environment placeholders
 * that vb-deploy normally fills in on a VB runtime instance.
 */
module.exports = (grunt) => {
  require('load-grunt-tasks')(grunt);

  if (grunt.option('local')) {
    const port = grunt.option('port') || 8888;

    grunt.config('vb-process-local.options.resolveTemplate', {});
    grunt.config('vb-process-local.environment', {
      'env.userProfileUrl': '_currentuser',
      'env.vbServer.url': `http://127.0.0.1:${port}/`,
      'env.vbServer.context': '',
      'env.application.id': 'maintenance',
      'env.application.version': Date.now(),
      'env.profileId': 'base_configuration',
    });
  }
};
