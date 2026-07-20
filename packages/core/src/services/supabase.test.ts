import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedItemByBarcode,
  getCachedItem,
  cacheCatalogItem,
  syncCollectionToCloud,
  loadCollectionFromCloud,
  isSupabaseConfigured,
  getSetParts,
  cacheSetParts,
  __resetSupabaseClientForTests,
  ensureAnonymousSession,
  getSessionSnapshot,
  linkEmailIdentity,
} from './supabase';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('../config', () => ({ getConfig: vi.fn() }));

function makeMockClient(queryResult: { data: any; error: any } = { data: null, error: null }) {
  const client: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    // makes the builder thenable for multi-row queries: await client.from().select().eq()
    then: (resolve: (v: any) => any) => Promise.resolve(queryResult).then(resolve),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  (createClient as any).mockReturnValue(client);
  return client;
}

const catalogRow = {
  id: 'set-10305', type: 'set', number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  piece_count: 4514, retired: false, estimated_value: 399.99,
  image_url: 'http://example.com/10305.jpg', barcode: '673419357562',
};

const collectionRow = {
  item_id: 'set-10305',
  status: 'collection',
  acquired_quality: 'new',
  saved_box: true,
  build_status: 'not-started',
  display_location: 'shelf',
  notes: '',
  missing_parts: '',
  quantity: 1,
  added_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  deleted_at: null,
  catalog_cache: catalogRow,
};

const ownedItem = {
  id: 'set-10305', type: 'set' as const, number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  pieceCount: 4514, retired: false, estimatedValue: 399.99,
  imageUrl: 'http://example.com/10305.jpg', barcode: '673419357562',
  status: 'collection' as const, acquiredQuality: 'new' as const,
  savedBox: true, buildStatus: 'not-started' as const,
  displayLocation: 'shelf', notes: '', missingParts: '',
  missingPartsList: [],
  quantity: 1, addedAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Supabase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSupabaseClientForTests();
    (getConfig as any).mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-key',
    });
  });

  describe('client singleton', () => {
    it('reuses a single client instance across calls', async () => {
      makeMockClient();
      await getCachedItem('set-10305');
      await getCachedItem('set-10305');
      expect(createClient).toHaveBeenCalledTimes(1);
      __resetSupabaseClientForTests();
      await getCachedItem('set-10305');
      expect(createClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureAnonymousSession', () => {
    it('returns offline reason and skips createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await ensureAnonymousSession()).toEqual({ ok: false, reason: 'offline' });
      expect(createClient).not.toHaveBeenCalled();
    });

    it('creates an anon session when none exists', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: { id: 'anon-1', is_anonymous: true } },
        error: null,
      });
      const result = await ensureAnonymousSession();
      expect(result).toEqual({ ok: true, userId: 'anon-1', isAnonymous: true });
      expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('returns the existing session without calling signInAnonymously', async () => {
      const client = makeMockClient();
      client.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: { id: 'user-9', is_anonymous: false } } },
        error: null,
      });
      const result = await ensureAnonymousSession();
      expect(result).toEqual({ ok: true, userId: 'user-9', isAnonymous: false });
      expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    });

    it('maps a disabled error to anon-disabled', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Anonymous sign-ins are disabled' },
      });
      expect(await ensureAnonymousSession()).toEqual({ ok: false, reason: 'anon-disabled' });
    });

    it('maps a 429 status to rate-limited', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'too many requests', status: 429 },
      });
      expect(await ensureAnonymousSession()).toEqual({ ok: false, reason: 'rate-limited' });
    });

    it('maps a network error to offline', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Failed to fetch' },
      });
      expect(await ensureAnonymousSession()).toEqual({ ok: false, reason: 'offline' });
    });

    it('maps an unrecognized error to unknown', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'something weird happened' },
      });
      expect(await ensureAnonymousSession()).toEqual({ ok: false, reason: 'unknown' });
    });
  });

  describe('getSessionSnapshot', () => {
    it('returns an empty snapshot after reset', () => {
      __resetSupabaseClientForTests();
      expect(getSessionSnapshot()).toEqual({ userId: null, isAnonymous: false });
    });

    it('reflects the session after a successful ensureAnonymousSession', async () => {
      const client = makeMockClient();
      client.auth.signInAnonymously.mockResolvedValueOnce({
        data: { user: { id: 'anon-1', is_anonymous: true } },
        error: null,
      });
      await ensureAnonymousSession();
      expect(getSessionSnapshot()).toEqual({ userId: 'anon-1', isAnonymous: true });
    });
  });

  describe('linkEmailIdentity', () => {
    it('rejects an invalid email without calling createClient', async () => {
      expect(await linkEmailIdentity('not-an-email')).toEqual({ ok: false, reason: 'invalid-email' });
      expect(createClient).not.toHaveBeenCalled();
    });

    it('returns network reason when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await linkEmailIdentity('user@example.com')).toEqual({ ok: false, reason: 'network' });
    });

    it('updates the user email and returns ok on success', async () => {
      const client = makeMockClient();
      const result = await linkEmailIdentity('user@example.com');
      expect(result).toEqual({ ok: true });
      expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'user@example.com' }, undefined);
    });

    it('sends the magic link back to the app origin when in a browser', async () => {
      const client = makeMockClient();
      vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
      try {
        await linkEmailIdentity('user@example.com');
        expect(client.auth.updateUser).toHaveBeenCalledWith(
          { email: 'user@example.com' },
          { emailRedirectTo: 'https://app.example.com' },
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('maps an already-registered error to email-taken', async () => {
      const client = makeMockClient();
      client.auth.updateUser.mockResolvedValueOnce({ error: { message: 'Email already registered' } });
      expect(await linkEmailIdentity('user@example.com')).toEqual({ ok: false, reason: 'email-taken' });
    });

    it('maps other errors to network', async () => {
      const client = makeMockClient();
      client.auth.updateUser.mockResolvedValueOnce({ error: { message: 'boom' } });
      expect(await linkEmailIdentity('user@example.com')).toEqual({ ok: false, reason: 'network' });
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

  describe('loadCollectionFromCloud', () => {
    it('returns null when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await loadCollectionFromCloud()).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    });

    it('returns null when user is not authenticated', async () => {
      makeMockClient();
      expect(await loadCollectionFromCloud()).toBeNull();
    });

    it('returns empty items and tombstoneIds when collection is empty', async () => {
      const client = makeMockClient({ data: [], error: null });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const result = await loadCollectionFromCloud();
      expect(result).toEqual({ items: [], tombstoneIds: [] });
    });

    it('splits live rows into items and deleted rows into tombstoneIds', async () => {
      const deletedRow = { ...collectionRow, item_id: 'set-99999', deleted_at: '2024-01-05T00:00:00.000Z', catalog_cache: { ...catalogRow, id: 'set-99999' } };
      const client = makeMockClient({ data: [collectionRow, deletedRow], error: null });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const result = await loadCollectionFromCloud();
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].id).toBe('set-10305');
      expect(result?.tombstoneIds).toEqual(['set-99999']);
    });

    it('maps DB column names to OwnedLegoItem camelCase fields', async () => {
      const client = makeMockClient({ data: [collectionRow], error: null });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const result = await loadCollectionFromCloud();
      const item = result?.items[0];
      expect(item?.pieceCount).toBe(4514);
      expect(item?.imageUrl).toBe('http://example.com/10305.jpg');
      expect(item?.buildStatus).toBe('not-started');
      expect(item?.displayLocation).toBe('shelf');
      expect(item?.addedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(item?.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns null when query returns an error', async () => {
      const client = makeMockClient({ data: null, error: { message: 'DB error' } });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      expect(await loadCollectionFromCloud()).toBeNull();
    });

    // SEC: missing_parts_list must survive round-trip through cloud
    it('maps missing_parts_list from DB row to missingPartsList on loaded item', async () => {
      const missingParts = [{ partNum: '3001', partName: 'Brick 2x4', colorName: 'Red', quantity: 1, imgUrl: '' }];
      const rowWithMissing = { ...collectionRow, missing_parts_list: missingParts };
      const client = makeMockClient({ data: [rowWithMissing], error: null });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const result = await loadCollectionFromCloud();
      expect(result?.items[0].missingPartsList).toEqual(missingParts);
    });

    it('loads missingPartsList as empty array when missing_parts_list column is absent in DB row', async () => {
      const client = makeMockClient({ data: [collectionRow], error: null });
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const result = await loadCollectionFromCloud();
      expect(result?.items[0].missingPartsList).toEqual([]);
    });
  });

  describe('syncCollectionToCloud', () => {
    it('returns early without calling createClient when not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      await syncCollectionToCloud([{ type: 'upsert', item: ownedItem }]);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('returns early when queue is empty', async () => {
      makeMockClient();
      await syncCollectionToCloud([]);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('returns early when user is not authenticated', async () => {
      const client = makeMockClient();
      await syncCollectionToCloud([{ type: 'upsert', item: ownedItem }]);
      expect(client.upsert).not.toHaveBeenCalled();
    });

    it('upserts items with correct shape for upsert entries', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      await syncCollectionToCloud([{ type: 'upsert', item: ownedItem }]);
      expect(client.from).toHaveBeenCalledWith('user_collection');
      expect(client.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            item_id: 'set-10305',
            user_id: 'user-123',
            status: 'collection',
            added_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            deleted_at: null,
          }),
        ]),
        { onConflict: 'item_id,user_id' },
      );
    });

    it('includes missing_parts_list in upsert payload', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const itemWithMissing = {
        ...ownedItem,
        missingPartsList: [{ partNum: '3001', partName: 'Brick 2x4', colorName: 'Red', quantity: 2, imgUrl: '' }],
      };
      await syncCollectionToCloud([{ type: 'upsert', item: itemWithMissing }]);
      expect(client.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ missing_parts_list: itemWithMissing.missingPartsList }),
        ]),
        { onConflict: 'item_id,user_id' },
      );
    });

    it('syncs missing_parts_list as empty array when missingPartsList is undefined on item', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      const { missingPartsList: _dropped, ...itemWithoutList } = ownedItem;
      await syncCollectionToCloud([{ type: 'upsert', item: itemWithoutList as any }]);
      expect(client.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ missing_parts_list: [] })]),
        { onConflict: 'item_id,user_id' },
      );
    });

    it('calls update with deleted_at for delete entries', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      await syncCollectionToCloud([{ type: 'delete', itemId: 'set-10305', deletedAt: '2024-02-01T00:00:00.000Z' }]);
      expect(client.update).toHaveBeenCalledWith({ deleted_at: '2024-02-01T00:00:00.000Z' });
    });

    it('throws when upsert returns an error', async () => {
      const client = makeMockClient();
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });
      client.upsert.mockResolvedValueOnce({ error: { message: 'sync failed' } });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(syncCollectionToCloud([{ type: 'upsert', item: ownedItem }]))
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

  const setPartRow = {
    id: 'uuid-1',
    set_id: 'set-75313',
    part_num: '3001',
    part_name: 'Brick 2 x 4',
    color_name: 'Red',
    quantity: 2,
    bag_num: 1,
    img_url: 'https://cdn.rebrickable.com/3001.png',
    is_spare: false,
  };

  describe('getSetParts', () => {
    it('returns mapped SetPart array from DB rows', async () => {
      makeMockClient({ data: [setPartRow], error: null });
      const parts = await getSetParts('set-75313');
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({
        partNum: '3001',
        partName: 'Brick 2 x 4',
        colorName: 'Red',
        quantity: 2,
        bagNum: 1,
        imgUrl: 'https://cdn.rebrickable.com/3001.png',
        isSpare: false,
      });
    });

    it('returns empty array on DB error', async () => {
      makeMockClient({ data: null, error: { message: 'DB error' } });
      expect(await getSetParts('set-75313')).toEqual([]);
    });

    it('returns empty array when Supabase is not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      expect(await getSetParts('set-75313')).toEqual([]);
    });

    it('maps null bag_num to null bagNum', async () => {
      makeMockClient({ data: [{ ...setPartRow, bag_num: null }], error: null });
      const parts = await getSetParts('set-75313');
      expect(parts[0].bagNum).toBeNull();
    });
  });

  const samplePart: import('../types/lego').SetPart = {
    partNum: '3001',
    partName: 'Brick 2 x 4',
    colorName: 'Red',
    quantity: 2,
    bagNum: 1,
    imgUrl: 'https://cdn.rebrickable.com/3001.png',
    isSpare: false,
  };

  describe('cacheSetParts', () => {
    it('calls upsert with mapped rows', async () => {
      const client = makeMockClient();
      await cacheSetParts('set-75313', [samplePart]);
      expect(client.upsert).toHaveBeenCalledWith(
        [
          {
            set_id: 'set-75313',
            part_num: '3001',
            part_name: 'Brick 2 x 4',
            color_name: 'Red',
            quantity: 2,
            bag_num: 1,
            img_url: 'https://cdn.rebrickable.com/3001.png',
            is_spare: false,
          },
        ],
        { onConflict: 'set_id,part_num,color_name', ignoreDuplicates: true }
      );
    });

    it('does nothing when parts array is empty', async () => {
      const client = makeMockClient();
      await cacheSetParts('set-75313', []);
      expect(client.upsert).not.toHaveBeenCalled();
    });

    it('does nothing when Supabase is not configured', async () => {
      (getConfig as any).mockReturnValue({ supabaseUrl: null, supabaseAnonKey: null });
      await expect(cacheSetParts('set-75313', [samplePart])).resolves.toBeUndefined();
    });
  });
});
