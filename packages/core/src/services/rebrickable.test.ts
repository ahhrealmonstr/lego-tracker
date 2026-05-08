import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchRebrickable } from './rebrickable';
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
  });
});
