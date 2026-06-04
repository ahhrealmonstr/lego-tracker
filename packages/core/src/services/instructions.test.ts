import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchInstructionBooklets } from './instructions';
import { getConfig } from '../config';

vi.mock('../config', () => ({ getConfig: vi.fn() }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchInstructionBooklets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as any).mockReturnValue({ supabaseUrl: 'https://abc.supabase.co' });
  });

  it('calls the edge function with the correct set_num', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booklets: [{ title: 'Part 1 of 2', url: 'https://cdn.lego.com/1.pdf' }],
        legoUrl: 'https://www.lego.com/en-us/service/building-instructions/10305',
      }),
    });
    const result = await fetchInstructionBooklets('10305-1');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('set_num=10305-1'));
    expect(result.booklets).toHaveLength(1);
    expect(result.booklets[0].title).toBe('Part 1 of 2');
    expect(result.legoUrl).toContain('10305');
  });

  it('returns empty booklets when supabaseUrl is missing', async () => {
    (getConfig as any).mockReturnValue({ supabaseUrl: null });
    const result = await fetchInstructionBooklets('10305-1');
    expect(result.booklets).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty booklets on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchInstructionBooklets('10305-1');
    expect(result.booklets).toEqual([]);
  });

  it('returns empty booklets on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await fetchInstructionBooklets('10305-1');
    expect(result.booklets).toEqual([]);
  });
});
