import { createClient } from '@supabase/supabase-js';
import type { LegoCatalogItem, LegoItemType, OwnedLegoItem } from '../types/lego';
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

export async function syncCollectionToCloud(items: OwnedLegoItem[]) {
  const supabase = getClient();
  if (!supabase) return;

  // Derive user_id from session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required for cloud sync');
  }

  const remoteItems = items.map(item => ({
    item_id: item.id,
    user_id: user.id,
    status: item.status,
    acquired_quality: item.acquiredQuality,
    saved_box: item.savedBox,
    build_status: item.buildStatus,
    display_location: item.displayLocation,
    notes: item.notes,
    missing_parts: item.missingParts,
    quantity: item.quantity,
    updated_at: item.updatedAt,
  }));

  const { error } = await supabase
    .from('user_collection')
    .upsert(remoteItems, { onConflict: 'item_id,user_id' });

  if (error) {
    console.error('Cloud sync error:', error.message);
    throw error;
  }
}

export function isSupabaseConfigured(): boolean {
  return getClient() !== null;
}
