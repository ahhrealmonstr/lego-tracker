import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL registers `afterEach(cleanup)` at IMPORT time, and in vitest a top-level
// `afterEach` binds to the importing file's suite. With a shared module registry
// the module evaluates once, so only the first file to import RTL gets cleanup —
// every later file renders into a DOM that is never torn down.
//
// Under `--no-isolate` that produced real failures: duplicate elements in
// SyncStatus.test.tsx, and `online` listeners from useSync.ts:52 accumulating so
// one dispatchEvent fanned out to three stale handlers.
//
// Registering it here makes cleanup a setup-file concern, which vitest applies
// per test file, instead of an import-order accident.
afterEach(cleanup);
