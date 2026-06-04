import { describe, it, expect } from 'vitest';
import { partsToCSV, partsToBSX } from './partsExport';
import type { SetPart } from '../types/lego';

const part1: SetPart = {
  partNum: '3001', partName: 'Brick 2x4', colorName: 'Red',
  quantity: 2, bagNum: 1, imgUrl: '', isSpare: false,
};
const part2: SetPart = {
  partNum: '3002', partName: 'Brick 1x4', colorName: 'Blue, Dark',
  quantity: 1, bagNum: 1, imgUrl: '', isSpare: false,
};

describe('partsToCSV', () => {
  it('returns empty string for no parts', () => {
    expect(partsToCSV([])).toBe('');
  });

  it('returns header + one row per part', () => {
    const csv = partsToCSV([part1]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('DesignNumber,ColorName,Quantity');
    expect(lines[1]).toBe('3001,Red,2');
  });

  it('quotes color names containing commas', () => {
    const csv = partsToCSV([part2]);
    expect(csv).toContain('"Blue, Dark"');
  });

  it('includes all parts', () => {
    const lines = partsToCSV([part1, part2]).split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('neutralizes formula injection by prefixing dangerous leading characters', () => {
    const injectionPart: SetPart = { ...part1, partNum: '=DANGEROUS', colorName: '+malicious' };
    const csv = partsToCSV([injectionPart]);
    // Values must start with ' prefix, not bare = or +
    expect(csv).toContain("'=DANGEROUS");
    expect(csv).toContain("'+malicious");
    // Must not appear as a bare unquoted formula start
    expect(csv).not.toMatch(/^=DANGEROUS/m);
    expect(csv).not.toMatch(/^[+]malicious/m);
  });
});

describe('partsToBSX', () => {
  it('returns valid BSX wrapper for empty parts', () => {
    const bsx = partsToBSX([]);
    expect(bsx).toContain('<BrickStockXML>');
    expect(bsx).toContain('<Inventory>');
    expect(bsx).toContain('</BrickStockXML>');
  });

  it('includes an Item block per part', () => {
    const bsx = partsToBSX([part1]);
    expect(bsx).toContain('<ItemID>3001</ItemID>');
    expect(bsx).toContain('<ColorName>Red</ColorName>');
    expect(bsx).toContain('<Qty>2</Qty>');
    expect(bsx).toContain('<ItemType>P</ItemType>');
  });

  it('escapes XML special characters in part num and color', () => {
    const weirdPart: SetPart = { ...part1, partNum: '3001&1', colorName: 'Red<Dark>' };
    const bsx = partsToBSX([weirdPart]);
    expect(bsx).toContain('3001&amp;1');
    expect(bsx).toContain('Red&lt;Dark&gt;');
  });
});
