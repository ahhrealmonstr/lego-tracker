import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.ts'],
    // Pinned deliberately, not inherited. Running with `--no-isolate` fails 19
    // tests here: `index.test.ts` imports the real barrel (and with it the real
    // `config.ts`) into a shared module registry before `rebrickable.test.ts`
    // declares `vi.mock('../config')`, so the SUT closes over the real
    // `getConfig`, every call short-circuits before `fetch`, and 19 error-path
    // and rate-limit assertions become vacuous. A 14-line barrel smoke test
    // silently disarms the security tests.
    isolate: true,
    // Restore every `vi.spyOn` original after each test. Without it, a spy's
    // implementation leaks into whatever test runs next, and a test can pass
    // because of a mock some earlier test installed — the failure mode this
    // suite has a documented history of. Three tests depended on that leak and
    // were rewritten to install their own mocks.
    restoreMocks: true,
  },
});
