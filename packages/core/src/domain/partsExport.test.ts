import { describe, it, expect } from 'vitest';
import { partsToCSV, partsToBSX, partsToLDR } from './partsExport';
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

describe('partsToLDR', () => {
  it('returns valid LDraw header', () => {
    const ldr = partsToLDR([], 'Test Model');
    expect(ldr).toContain('0 Test Model');
    expect(ldr).toContain('0 !LDRAW_ORG Unofficial_Model');
  });

  it('emits one line per quantity unit', () => {
    const ldr = partsToLDR([part1]); // quantity 2
    const brickLines = ldr.split('\r\n').filter(l => l.startsWith('1 '));
    expect(brickLines).toHaveLength(2);
  });

  it('uses LDraw colour 4 for Red', () => {
    const ldr = partsToLDR([part1]);
    expect(ldr).toContain('1 4 ');
  });

  it('falls back to colour 16 for unknown colour names', () => {
    const unknownPart: SetPart = { ...part1, colorName: 'Sparkle Unicorn Pink', quantity: 1 };
    const ldr = partsToLDR([unknownPart]);
    expect(ldr).toContain('1 16 ');
  });

  it('references the 3024 plate part', () => {
    const ldr = partsToLDR([part1]);
    expect(ldr).toContain('3024.dat');
  });

  it('includes a totals comment at the end', () => {
    const ldr = partsToLDR([part1, part2]);
    expect(ldr).toContain('2 unique parts');
    expect(ldr).toContain('3 total pieces');
  });

  it('returns a summary-only file for empty parts', () => {
    const ldr = partsToLDR([]);
    const brickLines = ldr.split('\r\n').filter(l => l.startsWith('1 '));
    expect(brickLines).toHaveLength(0);
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
