import { describe, it, expect } from 'vitest';
import { parseOmgBricksCSV } from './import';

const header = 'Set Number,Set Name,Year,Theme,Subtheme,Pieces,Minifigures,Quantity';

function csv(...rows: string[]): string {
  return [header, ...rows].join('\n');
}

describe('parseOmgBricksCSV', () => {
  it('returns empty array for header-only input', () => {
    expect(parseOmgBricksCSV(header)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseOmgBricksCSV('')).toEqual([]);
  });

  it('maps a plain set row correctly', () => {
    const [item] = parseOmgBricksCSV(csv('10305,Lion Knights Castle,2022,Icons,Castle,4514,0,1'));
    expect(item.id).toBe('set-10305');
    expect(item.type).toBe('set');
    expect(item.number).toBe('10305');
    expect(item.name).toBe('Lion Knights Castle');
    expect(item.theme).toBe('Icons');
    expect(item.year).toBe(2022);
    expect(item.pieceCount).toBe(4514);
    expect(item.quantity).toBe(1);
    expect(item.status).toBe('collection');
  });

  it('detects a collectible minifig (Collectable Minifigures, 1 fig, ≤20 pieces)', () => {
    const [item] = parseOmgBricksCSV(csv('71010,Wolf Guy,2015,Collectable Minifigures,Series 14 - Monsters,6,1,1'));
    expect(item.type).toBe('minifig');
    expect(item.id).toBe('fig-71010-wolf-guy');
  });

  it('keeps a sealed box as a set even in Collectable Minifigures theme (0 pieces)', () => {
    const [item] = parseOmgBricksCSV(csv('71034,LEGO Minifigures - Series 23 {Random bag},2022,Collectable Minifigures,Series 23,0,0,1'));
    expect(item.type).toBe('set');
  });

  it('gives unique IDs when the same set number appears for both a box and individual figs', () => {
    const items = parseOmgBricksCSV(csv(
      '71034,LEGO Minifigures - Series 23 {Random bag},2022,Collectable Minifigures,Series 23,0,0,1',
      '71034,Green Dragon Costume,2022,Collectable Minifigures,Series 23,9,1,1',
    ));
    expect(items).toHaveLength(2);
    const ids = new Set(items.map(i => i.id));
    expect(ids.size).toBe(2);
  });

  it('preserves quantity > 1', () => {
    const [item] = parseOmgBricksCSV(csv('71049,Ferrari,2025,Collectable Minifigures,Formula 1 Series,29,0,3'));
    expect(item.quantity).toBe(3);
  });

  it('clamps missing quantity to 1', () => {
    const [item] = parseOmgBricksCSV(csv('10305,Test Set,2022,Icons,,100,0,'));
    expect(item.quantity).toBe(1);
  });

  it('handles quoted names with commas', () => {
    const [item] = parseOmgBricksCSV(csv('21319,"Central Perk, NYC",2019,Ideas,Licensed,1070,7,1'));
    expect(item.name).toBe('Central Perk, NYC');
  });

  it('produces no duplicate IDs for a realistic multi-row input', () => {
    const rows = [
      '71034,LEGO Minifigures - Series 23 {Random bag},2022,Collectable Minifigures,Series 23,0,0,1',
      '71034,Green Dragon Costume,2022,Collectable Minifigures,Series 23,9,1,1',
      '71034,Cardboard Robot,2022,Collectable Minifigures,Series 23,7,1,1',
      '10305,Lion Knights Castle,2022,Icons,Castle,4514,0,1',
      '21319,Central Perk,2019,Ideas,Licensed,1070,7,1',
    ];
    const items = parseOmgBricksCSV(csv(...rows));
    const ids = items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets sensible defaults for all OwnedLegoItem fields', () => {
    const [item] = parseOmgBricksCSV(csv('10305,Test,2022,Icons,,100,0,1'));
    expect(item.retired).toBe(false);
    expect(item.estimatedValue).toBe(0);
    expect(item.imageUrl).toBe('');
    expect(item.savedBox).toBe(true);
    expect(item.buildStatus).toBe('not-started');
    expect(item.acquiredQuality).toBe('new');
    expect(item.notes).toBe('');
    expect(item.missingParts).toBe('');
    expect(item.missingPartsList).toEqual([]);
  });
});
