'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Heart, QrCode } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from '@/components/ui/button';
import { resolveRecipient } from '../lib/resolve-user';
import { friendlyError } from '@/lib/friendly-error';
import type { TipTarget } from './TipSheet';

interface ScanSheetProps {
  open: boolean;
  onClose: () => void;
  onTip: (target: TipTarget) => void;
  onOpenDrop?: (dropId: string) => void;
}

export function dropIdFromQr(value: string): string | null {
  const trimmed = value.trim();
  const path = trimmed.match(/\/drop\/([0-9a-fA-F-]{8,})/);
  if (path) return path[1];
  if (trimmed.toLowerCase().startsWith("devcity:drop:")) return trimmed.slice("devcity:drop:".length);
  try {
    const parsed = JSON.parse(trimmed) as { type?: string; kind?: string; id?: string };
    if ((parsed.type === "drop" || parsed.kind === "drop") && parsed.id) return parsed.id;
  } catch {
    return null;
  }
  return null;
}

function addressFromQr(value: string) {
  return value.match(/0x[a-fA-F0-9]{40}/)?.[0] ?? null;
}

export function ScanSheet({ open, onClose, onTip, onOpenDrop }: ScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onOpenDropRef = useRef(onOpenDrop);
  onOpenDropRef.current = onOpenDrop;
  const [cameraError, setCameraError] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualError, setManualError] = useState('');

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
            const text = result.getText();
            const dropId = dropIdFromQr(text);
            cancelled = true;
            setScanning(false);
            controlsStop();
            if (dropId) {
              onOpenDropRef.current?.(dropId);
              return;
            }
            setScannedValue(text);
          }
        });
        function controlsStop() {
          stopScanner?.();
        }
        stopScanner = controls.stop;
        if (cancelled) controls.stop();
      } catch (error) {
        setCameraError(friendlyError(error, 'The camera could not be opened. Type the code instead.'));
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

  const scannedDropId = dropIdFromQr(scannedValue);
  const scannedAddress = scannedDropId ? null : addressFromQr(scannedValue);
  const link = (() => {
    try {
      const parsed = new URL(scannedValue);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch {
      return null;
    }
  })();

  async function handleManualSubmit() {
    setManualError('');
    const value = manualValue.trim();
    if (!value) return;
    const address = addressFromQr(value);
    if (address) {
      setScannedValue(value);
      return;
    }
    // Not an address — treat as a DEVCITY username/handle and resolve it.
    const resolved = await resolveRecipient(value);
    if (!resolved) {
      setManualError('Could not find that DEVCITY username.');
      return;
    }
    onTip({
      name: resolved.name,
      initials: resolved.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'UD',
      color: 'orange',
      address: resolved.address,
    });
  }

  return (
    <Sheet open={open} onClose={onClose} eyebrow="DEVCITY · scan" title="Scan a QR code">
      <div className="scan-sheet-content">
        {scannedValue ? (
          <div className="scan-result" role="status">
            <span className="scan-result-icon"><QrCode size={22} /></span>
            <strong>{scannedDropId ? 'Drop found' : scannedAddress ? 'Wallet found' : link ? 'Link found' : 'QR code found'}</strong>
            <p>{scannedAddress ?? scannedValue}</p>
            {scannedDropId && (
              <Button type="button" onClick={() => onOpenDrop?.(scannedDropId)}>
                Open this drop
              </Button>
            )}
            {scannedAddress && (
              <Button
                type="button"
                onClick={() => onTip({
                  name: `Wallet ${scannedAddress.slice(0, 6)}…${scannedAddress.slice(-4)}`,
                  initials: '0X',
                  color: 'orange',
                  address: scannedAddress,
                })}
              >
                <Heart size={16} /> Tip this wallet
              </Button>
            )}
            {link && (
              <Button asChild>
                <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open link</a>
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setScannedValue('')}>Scan another code</Button>
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
            <p className="scan-help">Wallet QR codes open a tip. Links are shown for review before opening. You can also type a username (e.g. <em>oliseh</em>).</p>
            <form className="scan-manual-form" onSubmit={(event) => { event.preventDefault(); void handleManualSubmit(); }}>
              <label htmlFor="scan-manual-input">Or paste a wallet address, QR link, or DEVCITY username</label>
              <div>
                <input
                  id="scan-manual-input"
                  value={manualValue}
                  onChange={(event) => { setManualValue(event.target.value); setManualError(''); }}
                  placeholder="0x…, https://…, or username"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" disabled={!manualValue.trim()}>Continue</Button>
              </div>
            </form>
            {manualError && <p className="scan-camera-error" role="status">{manualError}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
