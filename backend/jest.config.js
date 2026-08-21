/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/*.test.ts',
    '**/tests/**/*.test.ts'
  ],
  moduleNameMapper: {
    // Strip .js extensions from imports so ts-jest can resolve .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: false,
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/scripts/**',
    '!src/__mocks__/**',
    '!src/**/__tests__/**',
    '!src/tests/**',
    '!src/**/*.test.ts',
  ],
  // CI gate: coverage must stay at or above these floors.
  // Baseline measured 2026-08 (35/17/21/35) — ratchet upwards as tests grow.
  coverageThreshold: {
    global: {
      statements: 34,
      branches: 16,
      functions: 20,
      lines: 34,
    },
  },
};
