import { createClient } from '@supabase/supabase-js';
import type { LegoCatalogItem, LegoItemType, OwnedLegoItem, SyncQueueEntry } from '../types/lego';
import { getConfig } from '../config';

function getClient() {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function isValidLegoType(type: any): type is LegoItemType {
  return type === 'set' || type === 'minifig';
}

function mapRowToItem(data: any): LegoCatalogItem {
  return {
    id: data.id,
    type: isValidLegoType(data.type) ? data.type : 'set',
    number: data.number,
    name: data.name,
    theme: data.theme,
    year: data.year,
    pieceCount: data.piece_count,
    retired: data.retired ?? false,
    estimatedValue: data.estimated_value ?? 0,
    imageUrl: data.image_url,
    barcode: data.barcode,
  };
}

function mapRowToOwnedItem(row: any): OwnedLegoItem {
  const catalog = row.catalog_cache;
  return {
    id: catalog.id,
    type: isValidLegoType(catalog.type) ? catalog.type : 'set',
    number: catalog.number,
    name: catalog.name,
    theme: catalog.theme,
    year: catalog.year,
    pieceCount: catalog.piece_count,
    retired: catalog.retired ?? false,
    estimatedValue: catalog.estimated_value ?? 0,
    imageUrl: catalog.image_url,
    barcode: catalog.barcode,
    status: row.status,
    acquiredQuality: row.acquired_quality,
    savedBox: row.saved_box,
    buildStatus: row.build_status,
    displayLocation: row.display_location ?? '',
    notes: row.notes ?? '',
    missingParts: row.missing_parts ?? '',
    quantity: row.quantity,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Catalog Cache Services
 */

export async function getCachedItem(id: string): Promise<LegoCatalogItem | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('catalog_cache')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return mapRowToItem(data);
}

export async function getCachedItemByBarcode(barcode: string): Promise<LegoCatalogItem | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('catalog_cache')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error || !data) return null;

  return mapRowToItem(data);
}

export async function cacheCatalogItem(item: LegoCatalogItem) {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.from('catalog_cache').upsert({
    id: item.id,
    type: item.type,
    number: item.number,
    name: item.name,
    theme: item.theme,
    year: item.year,
    piece_count: item.pieceCount,
    retired: item.retired,
    estimated_value: item.estimatedValue,
    image_url: item.imageUrl,
    barcode: item.barcode,
  });

  if (error) {
    console.error(`Failed to cache catalog item ${item.id}:`, error.message);
  }
}

/**
 * Collection Sync Services
 */

export async function loadCollectionFromCloud(): Promise<{ items: OwnedLegoItem[]; tombstoneIds: string[] } | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_collection')
    .select('*, catalog_cache!item_id(*)')
    .eq('user_id', user.id);

  if (error || !data) return null;

  const items = (data as any[])
    .filter(row => !row.deleted_at)
    .map(mapRowToOwnedItem);

  const tombstoneIds = (data as any[])
    .filter(row => row.deleted_at)
    .map(row => row.item_id);

  return { items, tombstoneIds };
}

export async function syncCollectionToCloud(queue: SyncQueueEntry[]): Promise<void> {
  if (queue.length === 0) return;
  const supabase = getClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const upsertEntries = queue.filter((e): e is Extract<SyncQueueEntry, { type: 'upsert' }> => e.type === 'upsert');
  const deleteEntries = queue.filter((e): e is Extract<SyncQueueEntry, { type: 'delete' }> => e.type === 'delete');

  if (upsertEntries.length > 0) {
    const rows = upsertEntries.map(e => ({
      item_id: e.item.id,
      user_id: user.id,
      status: e.item.status,
      acquired_quality: e.item.acquiredQuality,
      saved_box: e.item.savedBox,
      build_status: e.item.buildStatus,
      display_location: e.item.displayLocation,
      notes: e.item.notes,
      missing_parts: e.item.missingParts,
      quantity: e.item.quantity,
      added_at: e.item.addedAt,
      updated_at: e.item.updatedAt,
      deleted_at: null,
    }));

    const { error } = await supabase
      .from('user_collection')
      .upsert(rows, { onConflict: 'item_id,user_id' });

    if (error) {
      console.error('Cloud sync error:', error.message);
      throw error;
    }
  }

  for (const entry of deleteEntries) {
    const { error } = await (supabase
      .from('user_collection')
      .update({ deleted_at: entry.deletedAt })
      .eq('item_id', entry.itemId)
      .eq('user_id', user.id) as any);

    if (error) {
      console.error('Cloud delete error:', error.message);
      throw error;
    }
  }
}

export function isSupabaseConfigured(): boolean {
  return getClient() !== null;
}
