import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'no-unused-vars': 'off',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/setupTests.js'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        global: 'readonly',
        test: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
