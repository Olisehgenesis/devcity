import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';

// ─── WebCrypto primitives ──────────────────────────────────────────────────

function bufFromB64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64FromBuf(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250_000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  /** base64 IV */
  iv: string;
  /** base64 ciphertext */
  data: string;
  /** base64 salt used for PBKDF2 */
  salt: string;
  /** PBKDF2 iterations */
  iterations: number;
}

export async function encryptWithPassphrase(passphrase: string, plaintext: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    iv: b64FromBuf(iv.buffer),
    data: b64FromBuf(ct),
    salt: b64FromBuf(salt.buffer),
    iterations: 250_000,
  };
}

export async function decryptWithPassphrase(passphrase: string, payload: EncryptedPayload): Promise<string> {
  const salt = new Uint8Array(bufFromB64(payload.salt));
  const iv = new Uint8Array(bufFromB64(payload.iv));
  const key = await deriveKey(passphrase, salt);
  const ct = bufFromB64(payload.data);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ─── EOA wallet ─────────────────────────────────────────────────────────────

export interface LocalWallet {
  address: Address;
  /** Encrypted by the user's PIN or legacy passphrase; never store plaintext on disk. */
  encryptedPrivateKey: EncryptedPayload;
  /** User-facing wallet label, normally the account's DEVCITY handle. */
  name?: string;
  /** New wallets use a PIN. Omitted for legacy passphrase-protected wallets. */
  pinProtected?: boolean;
  /** Legacy encrypted recovery secret; not used by PIN-protected wallets. */
  recoverySecret?: EncryptedPayload;
  backupConsent: boolean;
  backupRef?: string;
  createdAt: number;
}

export function createEOA(): { address: Address; privateKey: Hex } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

// ─── IndexedDB storage (device-local) ───────────────────────────────────────

const DB_NAME = 'devcity26';
const DB_VERSION = 1;
const STORE = 'wallets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'address' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalWallet(wallet: LocalWallet): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(wallet);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLocalWallet(address: Address): Promise<LocalWallet | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(address);
    req.onsuccess = () => resolve((req.result as LocalWallet) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalWallets(): Promise<LocalWallet[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as LocalWallet[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalWallet(address: Address): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(address);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Opt-in encrypted cloud backup (server never sees plaintext) ─────────────

/**
 * If the user opts in, upload ONLY the passphrase-encrypted blob to the server.
 * The server stores ciphertext + public metadata; it can never decrypt.
 */
export async function uploadEncryptedBackup(address: Address, payload: EncryptedPayload): Promise<string> {
  const res = await fetch('/api/wallet/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      iv: payload.iv,
      data: payload.data,
      salt: payload.salt,
      iterations: payload.iterations,
    }),
  });
  if (!res.ok) throw new Error('Backup upload failed');
  const json = await res.json();
  return json.ref as string;
}

export interface BackupBlob {
  address: string;
  iv: string;
  data: string;
  salt: string;
  iterations: number;
}

/**
 * Fetch the server-side encrypted backup for the signed-in user.
 * Used to restore a wallet on a new device. The caller must supply the
 * passphrase/PIN to decrypt the blob; this function only retrieves ciphertext.
 */
export async function loadBackupForUser(userId: string): Promise<BackupBlob | null> {
  const res = await fetch(`/api/wallet/backup?userId=${encodeURIComponent(userId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load your wallet backup.');
  return (await res.json()) as BackupBlob;
}

/**
 * Fetch the server-side encrypted backup for a specific wallet address.
 * Ownership is enforced server-side against the signed-in session.
 */
export async function loadBackupForAddress(address: Address): Promise<BackupBlob | null> {
  const res = await fetch(`/api/wallet/backup?address=${encodeURIComponent(address)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load your wallet backup.');
  return (await res.json()) as BackupBlob;
}

// ─── Encrypted keystore export (no plaintext ever leaves the device) ────────

export interface EncryptedKeystoreFile {
  version: 1;
  address: Address;
  /** Base64 AES-GCM ciphertext of the private key. */
  data: string;
  /** Base64 IV. */
  iv: string;
  /** Base64 salt used for PBKDF2. */
  salt: string;
  iterations: number;
  kdf: 'PBKDF2-SHA256';
  cipher: 'AES-256-GCM';
  exportedAt: number;
}

/**
 * Build an encrypted keystore blob the user can save to disk and re-import
 * later — on any device, in any app that supports the same format. The
 * private key is never shown in plaintext.
 */
export async function exportEncryptedKeystore(
  address: Address,
  privateKey: string,
  passphrase: string,
): Promise<EncryptedKeystoreFile> {
  const encrypted = await encryptWithPassphrase(passphrase, privateKey);
  return {
    version: 1,
    address,
    data: encrypted.data,
    iv: encrypted.iv,
    salt: encrypted.salt,
    iterations: encrypted.iterations,
    kdf: 'PBKDF2-SHA256',
    cipher: 'AES-256-GCM',
    exportedAt: Date.now(),
  };
}

/**
 * Decrypt a keystore file previously produced by `exportEncryptedKeystore`.
 * Throws if the passphrase is wrong or the file is malformed.
 */
export async function importEncryptedKeystore(
  file: EncryptedKeystoreFile,
  passphrase: string,
): Promise<{ address: Address; privateKey: string }> {
  if (file.version !== 1) throw new Error('Unsupported keystore version.');
  if (file.kdf !== 'PBKDF2-SHA256' || file.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported keystore encryption parameters.');
  }
  const privateKey = await decryptWithPassphrase(passphrase, {
    iv: file.iv,
    data: file.data,
    salt: file.salt,
    iterations: file.iterations,
  });
  return { address: file.address, privateKey };
}

function downloadBlob(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of an encrypted keystore file.
 */
export function downloadEncryptedKeystore(file: EncryptedKeystoreFile, address: Address): void {
  const safe = address.slice(2, 10).toLowerCase();
  downloadBlob(`devcity-wallet-${safe}.keystore.json`, JSON.stringify(file, null, 2));
}

/**
 * Read an encrypted keystore file the user selected via an <input type="file">.
 */
export async function readEncryptedKeystoreFile(file: File): Promise<EncryptedKeystoreFile> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not a valid DEVCITY keystore file.');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid keystore file.');
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1 || obj.kdf !== 'PBKDF2-SHA256' || obj.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported keystore version or encryption.');
  }
  if (typeof obj.data !== 'string' || typeof obj.iv !== 'string' || typeof obj.salt !== 'string') {
    throw new Error('Invalid keystore payload.');
  }
  return obj as unknown as EncryptedKeystoreFile;
}
