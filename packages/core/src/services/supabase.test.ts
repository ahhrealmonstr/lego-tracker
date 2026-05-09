import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedItemByBarcode } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('../config', () => ({
  getConfig: vi.fn(),
}));

describe('Supabase Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as any).mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-key',
    });
    (createClient as any).mockReturnValue(mockSupabase);
  });

  describe('getCachedItemByBarcode', () => {
    it('should return item when barcode exists in cache', async () => {
      const mockData = {
        id: 'set-10305',
        type: 'set',
        number: '10305',
        name: 'Lion Knights Castle',
        theme: 'Icons',
        year: 2022,
        piece_count: 4514,
        image_url: 'http://example.com/10305.jpg',
        barcode: '673419357562',
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockData, error: null });

      const item = await getCachedItemByBarcode('673419357562');

      expect(mockSupabase.from).toHaveBeenCalledWith('catalog_cache');
      expect(mockSupabase.eq).toHaveBeenCalledWith('barcode', '673419357562');
      expect(item).toEqual({
        id: 'set-10305',
        type: 'set',
        number: '10305',
        name: 'Lion Knights Castle',
        theme: 'Icons',
        year: 2022,
        pieceCount: 4514,
        retired: false,
        estimatedValue: 0,
        imageUrl: 'http://example.com/10305.jpg',
        barcode: '673419357562',
      });
    });

    it('should return null when barcode is not found', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const item = await getCachedItemByBarcode('non-existent');

      expect(item).toBeNull();
    });

    it('should return null when supabase returns an error', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } });

      const item = await getCachedItemByBarcode('any-barcode');

      expect(item).toBeNull();
    });

    it('should return null if supabase client is not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });

      const item = await getCachedItemByBarcode('any-barcode');

      expect(item).toBeNull();
    });
  });
});
