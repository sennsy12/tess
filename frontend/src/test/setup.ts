/**
 * Global test setup for Vitest + React Testing Library
 *
 * This file is referenced by vitest.config.ts `setupFiles` and runs
 * before every test suite. It:
 *  1. Extends Vitest matchers with @testing-library/jest-dom helpers
 *     (e.g., toBeInTheDocument, toHaveTextContent).
 *  2. Stubs browser APIs that jsdom does not implement.
 */

import '@testing-library/jest-dom';

// ── Stubs for missing jsdom APIs ─────────────────────────────────────

// window.matchMedia is not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// IntersectionObserver is not implemented in jsdom
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});
