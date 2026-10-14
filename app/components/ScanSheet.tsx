'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, QrCode, Sparkles } from 'lucide-react';
import { Sheet } from './Sheet';
import type { TipTarget } from './TipSheet';

interface ScanSheetProps {
  open: boolean;
  onClose: () => void;
  onTip: (target: TipTarget) => void;
}

function addressFromQr(value: string) {
  return value.match(/0x[a-fA-F0-9]{40}/)?.[0] ?? null;
}

export function ScanSheet({ open, onClose, onTip }: ScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) {
      setScannedValue('');
      setManualValue('');
      setCameraError('');
      return;
    }

    let cancelled = false;
    let stopScanner: (() => void) | undefined;
    setCameraError('');
    setScanning(true);

    async function startScanner() {
      try {
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview is unavailable.');
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result && !cancelled) {
            setScannedValue(result.getText());
            cancelled = true;
            setScanning(false);
            controlsStop();
          }
        });
        function controlsStop() {
          stopScanner?.();
        }
        stopScanner = controls.stop;
        if (cancelled) controls.stop();
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : 'Could not access the camera.');
      } finally {
        if (!cancelled) setScanning(false);
      }
    }

    void startScanner();
    return () => {
      cancelled = true;
      stopScanner?.();
    };
  }, [open]);

  const scannedAddress = addressFromQr(scannedValue);
  const manualAddress = addressFromQr(manualValue.trim());
  const link = (() => {
    try {
      const parsed = new URL(scannedValue);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch {
      return null;
    }
  })();

  return (
    <Sheet open={open} onClose={onClose} eyebrow="DEVCITY · scan" title="Scan a QR code">
      <div className="scan-sheet-content">
        {scannedValue ? (
          <div className="scan-result" role="status">
            <span className="scan-result-icon"><QrCode size={22} /></span>
            <strong>{scannedAddress ? 'Wallet found' : link ? 'Link found' : 'QR code found'}</strong>
            <p>{scannedAddress ?? scannedValue}</p>
            {scannedAddress && (
              <button
                className="claim-button"
                onClick={() => onTip({
                  name: `Wallet ${scannedAddress.slice(0, 6)}…${scannedAddress.slice(-4)}`,
                  initials: '0X',
                  color: 'orange',
                  address: scannedAddress,
                })}
              >
                <Sparkles size={16} /> Tip this wallet
              </button>
            )}
            {link && <a className="scan-open-link" href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open link</a>}
            <button className="scan-again" onClick={() => setScannedValue('')}>Scan another code</button>
          </div>
        ) : (
          <>
            <div className="scan-camera-frame">
              <video ref={videoRef} muted playsInline aria-label="Live QR scanner camera preview" />
              <span className="scan-corner scan-corner-tl" />
              <span className="scan-corner scan-corner-tr" />
              <span className="scan-corner scan-corner-bl" />
              <span className="scan-corner scan-corner-br" />
              {!cameraError && <span className="scan-camera-status"><span className="live-dot" /> {scanning ? 'Starting camera…' : 'Point at a QR code'}</span>}
            </div>
            {cameraError && <p className="scan-camera-error" role="status">{cameraError}</p>}
            <p className="scan-help">Wallet QR codes open a tip. Links are shown for review before opening.</p>
            <form className="scan-manual-form" onSubmit={(event) => { event.preventDefault(); if (manualValue.trim()) setScannedValue(manualValue.trim()); }}>
              <label htmlFor="scan-manual-input">Or paste a wallet address or QR link</label>
              <div>
                <input
                  id="scan-manual-input"
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder="0x… or https://…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" disabled={!manualAddress && !manualValue.trim()}>Continue</button>
              </div>
            </form>
          </>
        )}
      </div>
    </Sheet>
  );
}
