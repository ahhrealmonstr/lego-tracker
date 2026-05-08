import { createClient } from '@supabase/supabase-js';
import type { LegoCatalogItem, OwnedLegoItem } from '../types/lego';
import { getConfig } from '../config';

function getClient() {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
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
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    type: data.type as any,
    number: data.number,
    name: data.name,
    theme: data.theme,
    year: data.year,
    pieceCount: data.piece_count,
    retired: false,
    estimatedValue: 0,
    imageUrl: data.image_url,
    barcode: data.barcode,
  };
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

  return {
    id: data.id,
    type: data.type as any,
    number: data.number,
    name: data.name,
    theme: data.theme,
    year: data.year,
    pieceCount: data.piece_count,
    retired: false,
    estimatedValue: 0,
    imageUrl: data.image_url,
    barcode: data.barcode,
  };
}

export async function cacheCatalogItem(item: LegoCatalogItem) {
  const supabase = getClient();
  if (!supabase) return;

  await supabase.from('catalog_cache').upsert({
    id: item.id,
    type: item.type,
    number: item.number,
    name: item.name,
    theme: item.theme,
    year: item.year,
    piece_count: item.pieceCount,
    image_url: item.imageUrl,
    barcode: item.barcode,
  });
}

/**
 * Collection Sync Services
 */

export async function syncCollectionToCloud(items: OwnedLegoItem[]) {
  const supabase = getClient();
  if (!supabase) return;

  const remoteItems = items.map(item => ({
    item_id: item.id,
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

  await supabase.from('user_collection').delete().neq('item_id', '');
  
  const { error } = await supabase.from('user_collection').insert(remoteItems);
  if (error) {
    console.error('Cloud sync error:', error);
    throw error;
  }
}

export function isSupabaseConfigured(): boolean {
  return getClient() !== null;
}
