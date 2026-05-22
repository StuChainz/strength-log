const expo = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expo,
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**'],
  },
  {
    rules: {
      'no-console': 'warn',
    },
  },
]);
