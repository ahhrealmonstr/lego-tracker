import { describe, it, expect, vi } from 'vitest';
import { parseThemes, mapSetRow, parseSets, upsertCatalog, type CatalogRow } from './seed-catalog';

describe('parseThemes', () => {
  it('builds a map of theme_id to name', () => {
    const csv = `id,name,parent_id\n158,Star Wars,\n171,Technic,`;
    const map = parseThemes(csv);
    expect(map.get('158')).toBe('Star Wars');
    expect(map.get('171')).toBe('Technic');
    expect(map.size).toBe(2);
  });

  it('returns empty map for header-only CSV', () => {
    const csv = `id,name,parent_id\n`;
    expect(parseThemes(csv).size).toBe(0);
  });
});

describe('mapSetRow', () => {
  const themeMap = new Map([['158', 'Star Wars']]);
  const baseRow = {
    set_num: '75313-1',
    name: 'AT-AT',
    year: '2021',
    theme_id: '158',
    num_parts: '6785',
    set_img_url: 'https://img.example.com/75313.jpg',
  };

  it('maps a CSV row to catalog_cache shape', () => {
    expect(mapSetRow(baseRow, themeMap)).toEqual({
      id: 'set-75313-1',
      type: 'set',
      number: '75313-1',
      name: 'AT-AT',
      theme: 'Star Wars',
      year: 2021,
      piece_count: 6785,
      retired: false,
      estimated_value: 0,
      image_url: 'https://img.example.com/75313.jpg',
      barcode: null,
    });
  });

  it('falls back to "Theme N" when theme_id is not in map', () => {
    expect(mapSetRow({ ...baseRow, theme_id: '999' }, themeMap)?.theme).toBe('Theme 999');
  });

  it('returns null for year < 1932', () => {
    expect(mapSetRow({ ...baseRow, year: '0' }, themeMap)).toBeNull();
  });

  it('uses placeholder image when set_img_url is empty', () => {
    const row = mapSetRow({ ...baseRow, set_img_url: '' }, themeMap);
    expect(row?.image_url).toContain('placeholder');
  });

  it('defaults piece_count to 0 when num_parts is empty string', () => {
    const row = mapSetRow({ ...baseRow, num_parts: '' }, themeMap);
    expect(row?.piece_count).toBe(0);
  });
});

describe('parseSets', () => {
  const themeMap = new Map([['158', 'Star Wars']]);

  it('parses a CSV string and resolves theme names', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      '75313-1,AT-AT,2021,158,6785,https://img.example.com/75313.jpg',
    ].join('\n');
    const rows = parseSets(csv, themeMap);
    expect(rows).toHaveLength(1);
    expect(rows[0].theme).toBe('Star Wars');
    expect(rows[0].id).toBe('set-75313-1');
  });

  it('filters out rows with year < 1932', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      'bad-0,Old,0,158,0,',
    ].join('\n');
    expect(parseSets(csv, themeMap)).toHaveLength(0);
  });

  it('handles set names with commas (quoted fields)', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      '75312-1,"Boba Fett\'s Starship, Imperial",2021,158,593,',
    ].join('\n');
    const rows = parseSets(csv, themeMap);
    expect(rows[0].name).toBe("Boba Fett's Starship, Imperial");
  });
});

describe('upsertCatalog', () => {
  function makeRow(i: number): CatalogRow {
    return {
      id: `set-test-${i}`,
      type: 'set',
      number: `${i}`,
      name: `Set ${i}`,
      theme: 'Test',
      year: 2020,
      piece_count: 10,
      retired: false,
      estimated_value: 0,
      image_url: '',
      barcode: null,
    };
  }

  it('calls supabase upsert in batches of 1000', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as any;
    const rows = Array.from({ length: 2500 }, (_, i) => makeRow(i));
    const count = await upsertCatalog(rows, client);
    expect(count).toBe(2500);
    expect(mockUpsert).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
  });

  it('throws on Supabase error', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    } as any;
    await expect(upsertCatalog([makeRow(0)], client)).rejects.toThrow('DB error');
  });

  it('returns 0 for empty input without calling supabase', async () => {
    const client = { from: vi.fn() } as any;
    const count = await upsertCatalog([], client);
    expect(count).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });
});
