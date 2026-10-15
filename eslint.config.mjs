import globals from 'globals';

// Visual Builder code is AMD (define/require) running in the browser.
export default [
  {
    files: ['webApps/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        define: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
  {
    // Desktop client (Electron main process, preload and build scripts): CommonJS on Node.
    files: ['desktop/**/*.js', 'Gruntfile.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
  {
    ignores: ['build/**', 'node_modules/**', '.local-src/**', 'desktop/node_modules/**', 'desktop/app/**', 'desktop/dist/**'],
  },
];
