import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedItemByBarcode, getCachedItem, cacheCatalogItem, syncCollectionToCloud, isSupabaseConfigured } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('../config', () => ({ getConfig: vi.fn() }));

function makeMockClient() {
  const client = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };
  (createClient as any).mockReturnValue(client);
  return client;
}

const ownedItem = {
  id: 'set-10305', type: 'set' as const, number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  pieceCount: 4514, retired: false, estimatedValue: 399.99,
  imageUrl: 'http://example.com/10305.jpg', barcode: '673419357562',
  status: 'collection' as const, acquiredQuality: 'new' as const,
  savedBox: true, buildStatus: 'not-started' as const,
  displayLocation: '', notes: '', missingParts: '',
  quantity: 1, addedAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Supabase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getConfig as any).mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-key',
    });
  });

  describe('getCachedItemByBarcode', () => {
    it('returns item when barcode exists in cache', async () => {
      const client = makeMockClient();
      client.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'set-10305', type: 'set', number: '10305',
          name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
          piece_count: 4514, image_url: 'http://example.com/10305.jpg',
          barcode: '673419357562',
        },
        error: null,
      });
      const item = await getCachedItemByBarcode('673419357562');
      expect(client.from).toHaveBeenCalledWith('catalog_cache');
      expect(client.eq).toHaveBeenCalledWith('barcode', '673419357562');
      expect(item?.id).toBe('set-10305');
      expect(item?.pieceCount).toBe(4514);
    });

    it('returns null when barcode is not found', async () => {
      makeMockClient();
      expect(await getCachedItemByBarcode('non-existent')).toBeNull();
    });

    it('returns null when supabase returns an error', async () => {
      const client = makeMockClient();
      client.maybeSingle.mockResolvedValueOnce({
        data: null, error: { message: 'connection timeout' },
      });
      expect(await getCachedItemByBarcode('any-barcode')).toBeNull();
    });

    it('returns null and skips createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await getCachedItemByBarcode('any-barcode')).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe('getCachedItem', () => {
    it('returns item when id exists in cache', async () => {
      const client = makeMockClient();
      client.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'set-10305', type: 'set', number: '10305',
          name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
          piece_count: 4514, image_url: 'http://example.com/10305.jpg',
          barcode: '673419357562',
        },
        error: null,
      });
      const item = await getCachedItem('set-10305');
      expect(client.from).toHaveBeenCalledWith('catalog_cache');
      expect(client.eq).toHaveBeenCalledWith('id', 'set-10305');
      expect(item?.id).toBe('set-10305');
    });

    it('returns null when id is not found', async () => {
      makeMockClient();
      expect(await getCachedItem('set-99999')).toBeNull();
    });

    it('returns null on supabase error', async () => {
      const client = makeMockClient();
      client.maybeSingle.mockResolvedValueOnce({
        data: null, error: { message: 'DB error' },
      });
      expect(await getCachedItem('set-10305')).toBeNull();
    });

    it('returns null and skips createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await getCachedItem('set-10305')).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe('cacheCatalogItem', () => {
    const catalogItem = {
      id: 'set-10305', type: 'set' as const, number: '10305',
      name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
      pieceCount: 4514, retired: false, estimatedValue: 399.99,
      imageUrl: 'http://example.com/10305.jpg', barcode: '673419357562',
    };

    it('upserts item to catalog_cache with snake_case fields', async () => {
      const client = makeMockClient();
      await cacheCatalogItem(catalogItem);
      expect(client.from).toHaveBeenCalledWith('catalog_cache');
      expect(client.upsert).toHaveBeenCalledWith(expect.objectContaining({
        id: 'set-10305',
        piece_count: 4514,
        image_url: 'http://example.com/10305.jpg',
      }));
    });

    it('logs error but does not throw when upsert fails', async () => {
      const client = makeMockClient();
      client.upsert.mockResolvedValueOnce({ error: { message: 'upsert failed' } });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(cacheCatalogItem(catalogItem)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('returns early without calling createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      await cacheCatalogItem(catalogItem);
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe('syncCollectionToCloud', () => {
    it('returns early without calling createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      await syncCollectionToCloud([ownedItem]);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('throws when user is not authenticated', async () => {
      makeMockClient();
      await expect(syncCollectionToCloud([ownedItem]))
        .rejects.toThrow('Authentication required for cloud sync');
    });

    it('upserts items with correct shape when authenticated', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } }, error: null,
      });
      await syncCollectionToCloud([ownedItem]);
      expect(client.from).toHaveBeenCalledWith('user_collection');
      expect(client.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            item_id: 'set-10305',
            user_id: 'user-123',
            status: 'collection',
          }),
        ]),
        { onConflict: 'item_id,user_id' },
      );
    });

    it('throws when upsert returns an error', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } }, error: null,
      });
      client.upsert.mockResolvedValueOnce({ error: { message: 'sync failed' } });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(syncCollectionToCloud([ownedItem]))
        .rejects.toMatchObject({ message: 'sync failed' });
      spy.mockRestore();
    });
  });

  describe('isSupabaseConfigured', () => {
    it('returns true when url and key are present', () => {
      expect(isSupabaseConfigured()).toBe(true);
    });

    it('returns false when supabaseUrl is null', () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: 'key' });
      expect(isSupabaseConfigured()).toBe(false);
    });

    it('returns false when supabaseAnonKey is null', () => {
      (getConfig as any).mockReturnValue({
        supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: null,
      });
      expect(isSupabaseConfigured()).toBe(false);
    });
  });
});
