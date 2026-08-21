/**
 * ESLint flat config.
 *
 * Layers:
 * 1. @eslint/js recommended          – baseline JS correctness
 * 2. typescript-eslint recommended   – TS-aware rules (no type-checked pass,
 *                                      tsc handles types separately)
 * 3. eslint-plugin-security          – static detection of injection-prone
 *                                      patterns (SQL string building, eval,
 *                                      child_process, unsafe regex, ...)
 */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'load-tests/**',
      'src/scripts/**', // plain-JS one-off utilities, not part of the app
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,

      // Dynamic property access is used pervasively (row mappers, column
      // whitelists, sort-key maps). All user-controlled keys are validated
      // upstream via zod enums or identifier whitelists — see
      // src/db/identifiers.ts, src/lib/sqlSort.ts, src/lib/sqlSearch.ts.
      'security/detect-object-injection': 'off',

      // Codebase convention: untyped query params/results are contained in
      // the data-access layer and covered by runtime validation.
      '@typescript-eslint/no-explicit-any': 'off',

      // Underscore-prefixed names signal intentionally-unused parameters
      // (e.g. Express middleware signatures, test stubs).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true, // allow `{ key: _omit, ...rest }` patterns
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Tests intentionally stub/misuse modules to exercise failure paths.
      'security/detect-non-literal-fs-filename': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
