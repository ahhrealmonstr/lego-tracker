import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchRebrickable, findRebrickableByBarcode } from './rebrickable';
import { getConfig } from '../config';

// Mock config
vi.mock('../config', () => ({
  getConfig: vi.fn()
}));

// Mock fetch
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
            { set_num: '75312-1', name: 'Boba Fett\'s Starship', year: 2021, theme_id: 158, num_parts: 593, set_img_url: 'http://example.com/75312.jpg' }
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

    it('should throw RateLimitError on 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map([['Retry-After', '30']])
      });

      await expect(findRebrickableByBarcode('5702016913484')).rejects.toThrow('rate limit exceeded');
    });
  });

  describe('searchRebrickable', () => {
    it('should return mapped items when API returns results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { set_num: '75312-1', name: 'Boba Fett\'s Starship', year: 2021, theme_id: 158, num_parts: 593, set_img_url: 'http://example.com/75312.jpg' }
          ]
        })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const items = await searchRebrickable('star wars');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        number: '75312-1',
        name: 'Boba Fett\'s Starship',
        type: 'set'
      });
    });

    it('should return empty array if API key is missing', async () => {
      (getConfig as any).mockReturnValue({ rebrickableApiKey: null });
      const items = await searchRebrickable('star wars');
      expect(items).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty array on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const items = await searchRebrickable('star wars');
      expect(items).toEqual([]);
    });

    it('should return empty array on non-ok status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const items = await searchRebrickable('star wars');
      expect(items).toEqual([]);
    });

    it('should throw RateLimitError on 429', async () => {
      mockFetch.mockResolvedValue({
        status: 429,
        headers: new Map([['Retry-After', '30']])
      });
      await expect(searchRebrickable('star wars')).rejects.toThrow('rate limit exceeded');
    });
  });
});
