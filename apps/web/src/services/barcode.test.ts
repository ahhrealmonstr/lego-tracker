import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canUseBarcodeDetector, scanVideoFrame } from './barcode';

describe('barcode service', () => {
  beforeEach(() => {
    delete (window as any).BarcodeDetector;
  });

  describe('canUseBarcodeDetector', () => {
    it('returns false when BarcodeDetector is not present on window', () => {
      expect(canUseBarcodeDetector()).toBe(false);
    });

    it('returns true when BarcodeDetector is present on window', () => {
      (window as any).BarcodeDetector = class {};
      expect(canUseBarcodeDetector()).toBe(true);
    });
  });

  describe('scanVideoFrame', () => {
    it('returns null when BarcodeDetector is unavailable', async () => {
      const video = document.createElement('video');
      expect(await scanVideoFrame(video)).toBeNull();
    });

    it('returns first detected barcode rawValue', async () => {
      const mockDetect = vi.fn().mockResolvedValue([{ rawValue: '673419357562' }]);
      (window as any).BarcodeDetector = vi.fn().mockImplementation(() => ({
        detect: mockDetect,
      }));
      const video = document.createElement('video');
      expect(await scanVideoFrame(video)).toBe('673419357562');
    });

    it('returns null when no barcodes are detected', async () => {
      const mockDetect = vi.fn().mockResolvedValue([]);
      (window as any).BarcodeDetector = vi.fn().mockImplementation(() => ({
        detect: mockDetect,
      }));
      const video = document.createElement('video');
      expect(await scanVideoFrame(video)).toBeNull();
    });

    it('constructs detector with the correct formats', async () => {
      const MockDetector = vi.fn().mockImplementation(() => ({
        detect: vi.fn().mockResolvedValue([]),
      }));
      (window as any).BarcodeDetector = MockDetector;
      await scanVideoFrame(document.createElement('video'));
      expect(MockDetector).toHaveBeenCalledWith({
        formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'],
      });
    });
  });
});
