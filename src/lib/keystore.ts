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
  /** encrypted by the user passphrase / recovery secret — never plaintext on disk */
  encryptedPrivateKey: EncryptedPayload;
  /** random recovery secret, shown once and encrypted with the passphrase */
  recoverySecret: EncryptedPayload;
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
