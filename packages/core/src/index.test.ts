import { describe, it, expect } from 'vitest';
import * as core from './index';

describe('core public barrel', () => {
  it('exports the cloud-backup auth wrappers', () => {
    expect(typeof core.ensureAnonymousSession).toBe('function');
    expect(typeof core.linkEmailIdentity).toBe('function');
    expect(typeof core.getSessionSnapshot).toBe('function');
  });

  it('does not leak the test-only supabase reset helper (N1)', () => {
    expect('__resetSupabaseClientForTests' in core).toBe(false);
  });
});
