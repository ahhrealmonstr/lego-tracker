import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';
import { canUseBarcodeDetector, scanVideoFrame } from '../services/barcode';

export function BarcodeScanner({
  onClose,
  onDetected,
  isScanning,
  statusMessage,
}: {
  onClose: () => void;
  onDetected: (barcode: string) => void;
  isScanning: boolean;
  statusMessage?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [browserMessage, setBrowserMessage] = useState(
    canUseBarcodeDetector() ? 'Point the camera at a barcode.' : 'Camera barcode detection is not supported in this browser.'
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let active = true;
    let frameId = 0;

    async function start() {
      if (!canUseBarcodeDetector() || isScanning) {
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) {
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (!active || !videoRef.current || isScanning) {
            return;
          }

          const code = await scanVideoFrame(videoRef.current);
          if (code) {
            onDetected(code);
            return;
          }

          frameId = window.setTimeout(tick, 350);
        };

        tick();
      } catch {
        setBrowserMessage('Camera permission failed. Enter the barcode manually.');
      }
    }

    start();

    return () => {
      active = false;
      window.clearTimeout(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected, isScanning]);

  return (
    <div className="modal-backdrop">
      <section className="scanner-modal">
        <div className="modal-heading">
          <h2>Scan barcode</h2>
          <button className="icon-button" type="button" title="Close" onClick={onClose} disabled={isScanning}>
            <X size={20} />
          </button>
        </div>
        <div className={`scanner-frame ${isScanning ? 'processing' : ''}`}>
          <video ref={videoRef} muted playsInline />
          {isScanning ? <RefreshCw size={34} className="spinning" /> : <Camera size={34} />}
        </div>
        <p>{isScanning ? 'Looking up item details...' : statusMessage || browserMessage}</p>
        <div className="manual-barcode">
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Enter barcode"
            disabled={isScanning}
          />
          <button type="button" onClick={() => onDetected(manualCode)} disabled={isScanning}>
            {isScanning ? 'Searching...' : 'Search'}
          </button>
        </div>
      </section>
    </div>
  );
}
