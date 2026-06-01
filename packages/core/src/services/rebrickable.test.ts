import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchRebrickable, findRebrickableByBarcode, findRebrickableItem } from './rebrickable';
import { getConfig } from '../config';

vi.mock('../config', () => ({
  getConfig: vi.fn()
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Rebrickable Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as any).mockReturnValue({ rebrickableApiKey: 'test-api-key' });
  });

  describe('findRebrickableByBarcode', () => {
    it('should find an item by barcode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { set_num: '75312-1', name: "Boba Fett's Starship", year: 2021, theme_id: 158, num_parts: 593, set_img_url: 'http://example.com/75312.jpg' }
          ]
        })
      });
      const item = await findRebrickableByBarcode('5702016913484');
      expect(item?.number).toBe('75312-1');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('barcode=5702016913484'));
    });

    it('should return null if API returns no results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] })
      });
      const item = await findRebrickableByBarcode('0000000000000');
      expect(item).toBeNull();
    });

    it('throws RateLimitError with correct retryAfter on 429', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429, ok: false,
        headers: { get: (k: string) => k === 'Retry-After' ? '30' : null },
      });
      await expect(findRebrickableByBarcode('5702016913484'))
        .rejects.toMatchObject({ retryAfter: 30 });
    });

    it('falls back to minifigs when no set found for barcode', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{
              set_num: 'fig-001', name: 'Luke', year: 1999,
              theme_id: 1, num_parts: 5, set_img_url: '',
            }],
          }),
        });
      const item = await findRebrickableByBarcode('1234567890');
      expect(item?.type).toBe('minifig');
      expect(item?.number).toBe('fig-001');
    });
  });

  describe('searchRebrickable', () => {
    it('should return mapped items when API returns results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { set_num: '75312-1', name: "Boba Fett's Starship", year: 2021, theme_id: 158, num_parts: 593, set_img_url: 'http://example.com/75312.jpg' }
          ]
        })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });
      const items = await searchRebrickable('star wars');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ number: '75312-1', type: 'set' });
    });

    it('should return empty array if API key is missing', async () => {
      (getConfig as any).mockReturnValue({ rebrickableApiKey: null });
      const items = await searchRebrickable('star wars');
      expect(items).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty array on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      expect(await searchRebrickable('star wars')).toEqual([]);
    });

    it('should return empty array on non-ok status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await searchRebrickable('star wars')).toEqual([]);
    });

    it('throws RateLimitError with correct retryAfter on 429', async () => {
      mockFetch.mockResolvedValue({
        status: 429,
        headers: { get: (k: string) => k === 'Retry-After' ? '30' : null },
      });
      await expect(searchRebrickable('star wars'))
        .rejects.toMatchObject({ retryAfter: 30 });
    });

    it('returns empty array for queries shorter than 3 characters', async () => {
      expect(await searchRebrickable('ab')).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('findRebrickableItem', () => {
    it('fetches a set by number using the /sets/ endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          set_num: '75312-1', name: "Boba Fett's Starship", year: 2021,
          theme_id: 158, num_parts: 593, set_img_url: 'http://example.com/75312.jpg',
        }),
      });
      const item = await findRebrickableItem('75312-1', 'set');
      expect(item?.type).toBe('set');
      expect(item?.number).toBe('75312-1');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/sets/75312-1/'));
    });

    it('fetches a minifig using the /minifigs/ endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          set_num: 'sw0001', name: 'Battle Droid', year: 1999,
          theme_id: 1, num_parts: 5, set_img_url: '',
        }),
      });
      const item = await findRebrickableItem('sw0001', 'minifig');
      expect(item?.type).toBe('minifig');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/minifigs/sw0001/'));
    });

    it('returns null when the API returns a non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      expect(await findRebrickableItem('99999-1', 'set')).toBeNull();
    });

    it('propagates RateLimitError', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429, ok: false,
        headers: { get: (k: string) => k === 'Retry-After' ? '60' : null },
      });
      await expect(findRebrickableItem('75312-1', 'set'))
        .rejects.toMatchObject({ retryAfter: 60 });
    });
  });
});
