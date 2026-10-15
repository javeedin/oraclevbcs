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
    ignores: ['build/**', 'node_modules/**'],
  },
];
