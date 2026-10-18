'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  exportEncryptedKeystore,
  downloadEncryptedKeystore,
  readEncryptedKeystoreFile,
  importEncryptedKeystore,
  uploadEncryptedBackup,
  saveLocalWallet,
  encryptWithPassphrase,
  type LocalWallet,
  type EncryptedKeystoreFile,
} from '@/lib/keystore';
import type { Hex } from 'viem';
import { useUnlockedKey } from '../../hooks/useUnlockedKey';

interface Fee {
  symbol: string;
  name: string;
}

interface WalletSecurityTabProps {
  wallet: LocalWallet;
  unlockedKey: Hex | null;
  fees: Fee[];
  feeSymbol: string;
  setFeeSymbol: (symbol: string) => void;
  onWalletChange: (wallet: LocalWallet) => void;
  onUnlockKey?: (key: Hex) => void;
  onSignOut?: () => void;
  notify?: (message: string) => void;
}

export function WalletSecurityTab({ wallet, unlockedKey, fees, feeSymbol, setFeeSymbol, onWalletChange, onUnlockKey, notify }: WalletSecurityTabProps) {
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [keystoreFile, setKeystoreFile] = useState<EncryptedKeystoreFile | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');

  async function handleBackup(consent: boolean) {
    if (!consent) {
      onWalletChange({ ...wallet, backupConsent: false });
      return;
    }
    setBackupSaving(true);
    setError('');
    try {
      const ref = await uploadEncryptedBackup(wallet.address, wallet.encryptedPrivateKey);
      const next = { ...wallet, backupConsent: true, backupRef: ref };
      await saveLocalWallet(next);
      onWalletChange(next);
      setBackupDone(true);
      notify?.('Encrypted backup saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBackupSaving(false);
    }
  }

  const sessionKey = useUnlockedKey(wallet.address);
  const activeKey = unlockedKey ?? sessionKey;

  async function handleExport() {
    if (!activeKey) { setError('Unlock your wallet before exporting.'); return; }
    if (!passphrase) { setError('Choose a passphrase for the keystore file.'); return; }
    setExporting(true);
    setError('');
    try {
      const file = await exportEncryptedKeystore(wallet.address, activeKey, passphrase);
      downloadEncryptedKeystore(file, wallet.address);
      setPassphrase('');
      notify?.('Encrypted keystore file downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export keystore.');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setError('');
    try {
      setKeystoreFile(await readEncryptedKeystoreFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read keystore file.');
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!keystoreFile) return;
    if (!passphrase) { setError('Enter the passphrase for this keystore file.'); return; }
    setImporting(true);
    setError('');
    try {
      const { address, privateKey } = await importEncryptedKeystore(keystoreFile, passphrase);
      if (!/^0x[0-9a-f]{64}$/.test(privateKey)) {
        throw new Error('The imported keystore does not contain a valid private key.');
      }
      const encryptedPrivateKey = await encryptWithPassphrase(passphrase, privateKey);
      const local: LocalWallet = {
        address,
        name: wallet.name,
        pinProtected: true,
        encryptedPrivateKey,
        backupConsent: false,
        createdAt: Date.now(),
      };
      await saveLocalWallet(local);
      onWalletChange(local);
      setKeystoreFile(null);
      setPassphrase('');
      notify?.('Wallet imported from keystore file.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import keystore.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="wallet-security-details wallet-security-tab" aria-label="Wallet security">
      <div className="wallet-security-content">
        <h3 className="you-section-title">Pay network fees with</h3>
        <div className="fee-currency-row">
          {fees.map((f) => (
            <button key={f.symbol} className={`fee-currency-chip${feeSymbol === f.symbol ? ' is-selected' : ''}`} onClick={() => setFeeSymbol(f.symbol)}>
              {f.symbol}
            </button>
          ))}
        </div>
        <h3 className="you-section-title wallet-backup-title">Encrypted backup</h3>
        <p className="profile-control-hint">Your signing key stays encrypted with your PIN. Back up so you can restore on another device.</p>
        <label className="you-checkbox">
          <input type="checkbox" checked={wallet.backupConsent} disabled={backupSaving} onChange={(e) => void handleBackup(e.target.checked)} />
          <span>Save an encrypted backup</span>
        </label>
        {backupSaving && <p className="you-note">Encrypting and uploading…</p>}
        {backupDone && <p className="you-note">Encrypted backup saved.</p>}
        <h3 className="you-section-title wallet-backup-title">Encrypted keystore file</h3>
        <p className="profile-control-hint">Export your key as an encrypted file you can save anywhere, or import one on any device.</p>
        {!activeKey ? (
          <p className="you-note">Unlock your wallet to export or import a keystore file.</p>
        ) : (
          <>
            <label className="wallet-field-label" htmlFor="wallet-keystore-passphrase">Passphrase for keystore file</label>
            <input id="wallet-keystore-passphrase" type="password" className="you-passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Choose a passphrase" autoComplete="new-password" />
            <button className="you-connect-secondary" disabled={exporting || !passphrase} onClick={() => void handleExport()}>
              {exporting ? 'Writing…' : 'Download encrypted keystore file'}
            </button>
          </>
        )}
        <div className="wallet-keystore-import">
          <label className="wallet-field-label" htmlFor="wallet-keystore-file">Import a keystore file (.keystore.json)</label>
          <input
            id="wallet-keystore-file"
            type="file"
            accept="application/json,.keystore.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>
        {keystoreFile && (
          <div className="wallet-keystore-confirm">
            <p className="you-note">Importing keystore for {keystoreFile.address.slice(0, 8)}…{keystoreFile.address.slice(-6)}.</p>
            <label className="wallet-field-label" htmlFor="wallet-keystore-import-passphrase">Passphrase for this keystore file</label>
            <input id="wallet-keystore-import-passphrase" type="password" className="you-passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Enter the passphrase" autoComplete="current-password" />
            <button className="you-connect-primary" disabled={importing || !passphrase} onClick={() => void confirmImport()}>
              {importing ? 'Importing…' : 'Import this wallet'}
            </button>
            <button className="you-connect-secondary" onClick={() => { setKeystoreFile(null); setPassphrase(''); }}>Cancel</button>
          </div>
        )}
      </div>
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
