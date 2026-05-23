const expo = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expo,
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-web/**', 'web/**', '.expo/**', '.claude/**'],
  },
  {
    rules: {
      'no-console': 'warn',
    },
  },
]);
