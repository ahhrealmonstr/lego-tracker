type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource | Blob | ImageData): Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export function canUseBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && Boolean(window.BarcodeDetector);
}

export async function scanVideoFrame(video: HTMLVideoElement): Promise<string | null> {
  if (!window.BarcodeDetector) {
    return null;
  }

  const detector = new window.BarcodeDetector({
    formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'],
  });
  const codes = await detector.detect(video);
  return codes[0]?.rawValue ?? null;
}
