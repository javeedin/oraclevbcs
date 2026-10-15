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
 *
 * Redwood components: settings/dependencies.json lists the oj-sp components (VB Studio
 * resolves them through its Component Exchange), and app-flow.json maps oj-sp to Oracle's
 * CDN. A local vb-process-local stops with "Missing mandatory component exchange URL"
 * for listed components, so "npm run build" / "npm run serve" first copy the app to
 * .local-src/ without the component list (task local-sources) and build that copy:
 * the templates then load straight from Oracle's CDN through the app-flow.json mapping.
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

  grunt.registerTask(
    'local-sources',
    'Copies the app to .local-src/ with empty component-dependencies (local builds without the Component Exchange).',
    () => {
      const dest = '.local-src';
      if (grunt.file.exists(dest)) {
        grunt.file.delete(dest);
      }
      const files = grunt.file.expand({ dot: true, nodir: true }, [
        'visual-application.json',
        'settings/**',
        'webApps/**',
        'businessObjects/**',
        'services/**',
        'processes/**',
      ]);
      files.forEach((file) => grunt.file.copy(file, `${dest}/${file}`));
      grunt.file
        .expand([`${dest}/settings/dependencies.json`, `${dest}/webApps/*/settings/dependencies.json`])
        .forEach((file) => grunt.file.write(file, `${JSON.stringify({ 'component-dependencies': {} }, null, 2)}\n`));
      grunt.log.ok(`Copied ${files.length} files to ${dest}/ without component-dependencies.`);
    },
  );
};
