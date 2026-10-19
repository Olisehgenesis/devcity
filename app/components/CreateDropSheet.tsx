'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, ArrowRight, Gift, LocateFixed, MapPin, Search, X } from 'lucide-react';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ACTIVE_CHAIN, feeCurrenciesFor } from '@/lib/celo';
import { writeContractWithFee, type TxRequest } from '@/lib/gas';
import { useFeeQuote } from '../hooks/useFeeQuote';
import { FeePreview } from './wallet/FeePreview';
import { PinBoxes } from './PinBoxes';
import { ERC20_ABI, CELO_SEPOLIA } from '@/lib/chain';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { getUnlockedPrivateKey, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { useUnlockedKey } from '../hooks/useUnlockedKey';
import { getImportedWalletTokens, type ImportedWalletToken } from '@/lib/wallet-assets';
import { Sheet } from './Sheet';

const DROP_CREATE_ABI = [
  { type: 'function', name: 'createDrop', stateMutability: 'nonpayable', inputs: [
    { name: 'dropId', type: 'bytes32' },
    { name: 'token', type: 'address' },
    { name: 'totalAmount', type: 'uint256' },
    { name: 'amountPerClaim', type: 'uint256' },
    { name: 'maxClaimants', type: 'uint256' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'claimAuthority', type: 'address' },
    { name: 'eventId', type: 'bytes32' },
    { name: 'placeId', type: 'bytes32' },
  ], outputs: [] },
] as const;

type Step = 'location' | 'token' | 'amount' | 'review';

interface DropLocation {
  lat: number;
  lng: number;
  name: string;
}

interface SpendableToken {
  key: string;
  symbol: string;
  name: string;
  /** ERC-20 contract address, or empty string for native CELO. */
  address: string;
  decimals: number;
  balance: number;
  balanceRaw: bigint;
}

interface CreateDropSheetProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
  initialLocation?: { lat: number; lng: number } | null;
  skipLocation?: boolean;
  notify?: (message: string) => void;
  onCreated?: (drop: { id: string; lat: number | null; lng: number | null }) => void;
  onNeedWallet?: () => void;
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

function nominatimSearch(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
  return fetch(url, { signal, headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.resolve([])));
}

function nominatimReverse(lat: number, lng: number, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  return fetch(url, { signal, headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
    .then((data: { display_name?: string; lat?: string; lon?: string } | null) =>
      data?.display_name ? { lat: data.lat as string, lon: data.lon as string, display_name: data.display_name } : null,
    );
}

export function CreateDropSheet({ open, onClose, walletAddress, initialLocation, skipLocation, notify, onCreated, onNeedWallet }: CreateDropSheetProps) {
  const [step, setStep] = useState<Step>('location');
  const [location, setLocation] = useState<DropLocation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [tokens, setTokens] = useState<SpendableToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenKey, setTokenKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [maxClaimants, setMaxClaimants] = useState('100');
  const [endsIn, setEndsIn] = useState('24');

  const [publishing, setPublishing] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [publishError, setPublishError] = useState('');
  const [pin, setPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const sessionKey = useUnlockedKey(walletAddress);

  const openedWithLocation = useRef(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinRef = useRef<MapLibreMarker | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);

  const chainId = ACTIVE_CHAIN.id;
  const chainLabel = ACTIVE_CHAIN.name;

  const connected = Boolean(walletAddress);
  const selectedToken = useMemo(
    () => tokens.find((t) => t.key === tokenKey) ?? null,
    [tokenKey, tokens],
  );
  const needsUnlock = Boolean(walletAddress) && !sessionKey;

  // ─── Load owned tokens with real balances (public reads, no unlock needed) ──
  useEffect(() => {
    if (!open || !walletAddress) return;
    let cancelled = false;
    setTokensLoading(true);
    const client = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]) });
    const addr = walletAddress as Address;

    const feeCurrencies = feeCurrenciesFor(chainId).map((f) => ({ symbol: f.symbol, name: f.name, address: f.address, decimals: f.decimals }));
    const imported: ImportedWalletToken[] = getImportedWalletTokens(walletAddress, chainId);

    const readBalance = async (tokenAddress: string): Promise<bigint> => {
      try {
        return await client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] });
      } catch {
        return BigInt(0);
      }
    };

    async function load() {
      const candidates: SpendableToken[] = [];
      for (const fee of feeCurrencies) {
        const raw = await readBalance(fee.address);
        candidates.push({ key: `erc20:${fee.address.toLowerCase()}`, symbol: fee.symbol, name: fee.name, address: fee.address, decimals: fee.decimals, balance: Number(formatUnits(raw, fee.decimals)), balanceRaw: raw });
      }
      for (const t of imported) {
        const raw = await readBalance(t.address);
        candidates.push({ key: `erc20:${t.address.toLowerCase()}`, symbol: t.symbol, name: t.name, address: t.address, decimals: t.decimals, balance: Number(formatUnits(raw, t.decimals)), balanceRaw: raw });
      }
      // Profile token (owned by this wallet) — real deployed token.
      try {
        const profileAddress = await client.readContract({ address: CELO_SEPOLIA.profileTokenFactory as Address, abi: PROFILE_FACTORY_ABI, functionName: 'getUserToken', args: [addr] });
        if (profileAddress && profileAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
          const [symbol, name, decimals] = await Promise.all([
            client.readContract({ address: profileAddress, abi: ERC20_ABI, functionName: 'symbol' }),
            client.readContract({ address: profileAddress, abi: ERC20_ABI, functionName: 'name' }),
            client.readContract({ address: profileAddress, abi: ERC20_ABI, functionName: 'decimals' }),
          ]);
          const raw = await client.readContract({ address: profileAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] });
          candidates.push({ key: `erc20:${profileAddress.toLowerCase()}`, symbol, name, address: profileAddress, decimals: Number(decimals), balance: Number(formatUnits(raw, Number(decimals))), balanceRaw: raw });
        }
      } catch {
        // profile token not found/readable — skip
      }
      const owned = candidates.filter((t) => t.balanceRaw > BigInt(0));
      if (!cancelled) {
        setTokens(owned);
        setTokensLoading(false);
        setTokenKey((prev) => (prev && owned.some((t) => t.key === prev) ? prev : (owned.length ? owned[0].key : null)));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, walletAddress, chainId]);

  useEffect(() => {
    if (!open) {
      openedWithLocation.current = false;
      return;
    }
    if (openedWithLocation.current) return;
    openedWithLocation.current = true;
    if (skipLocation && initialLocation) {
      setLocation({ lat: initialLocation.lat, lng: initialLocation.lng, name: 'Selected on the map' });
      setStep('token');
    }
  }, [initialLocation, open, skipLocation]);

  // ─── Location mini-map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open || step !== 'location' || skipLocation || !mapContainer.current || mapRef.current) return;
    maplibregl.setWorkerUrl('/maplibre-gl-worker');
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: initialLocation ? [initialLocation.lng, initialLocation.lat] : [72.8697, 19.0662],
      zoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const placePin = (lng: number, lat: number) => {
      const existing = pinRef.current;
      const marker = existing ?? new maplibregl.Marker({ draggable: true, color: '#22c55e' }).addTo(map);
      marker.setLngLat([lng, lat]);
      pinRef.current = marker;
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        applyLocation(pos.lng, pos.lat);
      });
    };

    const applyLocation = async (lng: number, lat: number) => {
      setLocation((prev) => ({ lat, lng, name: prev?.name ?? 'Selected location' }));
      const result = await nominatimReverse(lat, lng);
      setLocation({ lat, lng, name: result?.display_name ?? 'Selected location' });
    };

    map.on('load', () => {
      if (initialLocation) placePin(initialLocation.lng, initialLocation.lat);
    });
    map.on('click', (e) => {
      placePin(e.lngLat.lng, e.lngLat.lat);
      void applyLocation(e.lngLat.lng, e.lngLat.lat);
    });
    map.on('error', (e) => console.error('Create drop map error:', e.error));

    return () => {
      pinRef.current?.remove();
      pinRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const doSearch = useCallback(async (query: string) => {
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await nominatimSearch(query, controller.signal);
    setSearching(false);
    if (!controller.signal.aborted) setSearchResults(results);
  }, []);

  const pickSearchResult = (result: GeocodeResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setLocation({ lat, lng, name: result.display_name });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 700 });
    if (pinRef.current) pinRef.current.setLngLat([lng, lat]);
    setSearchResults([]);
    setSearchTerm('');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const lat = coords.latitude;
        const lng = coords.longitude;
        setLocation({ lat, lng, name: 'Your location' });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 700 });
        if (pinRef.current) pinRef.current.setLngLat([lng, lat]);
        const result = await nominatimReverse(lat, lng);
        setLocation({ lat, lng, name: result?.display_name ?? 'Your location' });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError('We couldn’t access your location. Search or tap the map instead.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const canContinueLocation = Boolean(location);

  const amountNum = Number(amount);
  const claimantsNum = Number(maxClaimants);
  const totalAllocated = selectedToken && amountNum > 0 && Number.isFinite(claimantsNum) && claimantsNum > 0
    ? amountNum * claimantsNum
    : 0;
  const amountValid = selectedToken
    && amountNum > 0
    && Number.isFinite(claimantsNum)
    && claimantsNum >= 1
    && Number.isInteger(claimantsNum)
    && totalAllocated <= selectedToken.balance;
  const amountError = selectedToken && amountNum > 0 && Number.isFinite(claimantsNum) && claimantsNum >= 1 && totalAllocated > selectedToken.balance
    ? `Total ${totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedToken.symbol} exceeds your balance of ${selectedToken.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}.`
    : '';
  const publishFeeRequest = useMemo<TxRequest | null>(() => {
    if (!selectedToken || !amountValid) return null;
    const total = parseUnits(String(amountNum), selectedToken.decimals) * BigInt(claimantsNum);
    return {
      to: selectedToken.address as Address,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CELO_SEPOLIA.dropClaim as Address, total],
      }),
    };
  }, [amountNum, amountValid, claimantsNum, selectedToken]);
  const publishFee = useFeeQuote(walletAddress, step === 'review' ? publishFeeRequest : null);

  async function ensureUnlocked(): Promise<Hex> {
    if (!walletAddress) throw new Error('Connect a wallet first.');
    const existing = getUnlockedPrivateKey(walletAddress);
    if (existing) return existing;
    if (!/^\d{6}$/.test(pin)) throw new Error('Enter your 6-digit wallet PIN to sign this transaction.');
    const local = await loadLocalWallet(walletAddress as Address);
    if (!local) throw new Error('Wallet not found on this device.');
    const privateKey = (await decryptWithPassphrase(pin, local.encryptedPrivateKey)) as Hex;
    rememberUnlockedWallet(local.address, privateKey);
    setPin('');
    return privateKey;
  }

  async function publish() {
    if (!selectedToken || !location || !amountValid || !walletAddress) return;
    setPublishing(true);
    setPublishState('pending');
    setPublishError('');
    setUnlockError('');
    let dropId = '';
    try {
      // 1) Ensure the wallet is unlocked — genuinely required to sign the tx.
      const privateKey = await ensureUnlocked();
      const dropClaim = CELO_SEPOLIA.dropClaim as Address;

      // 2) Resolve the on-chain claim authority (authorized backend signer).
      const signerRes = await fetch('/api/drops/signer');
      const signerData = await signerRes.json().catch(() => ({}));
      if (!signerRes.ok || !signerData.claimAuthority) throw new Error(signerData?.error || 'Claim signer is not configured.');
      const claimAuthority = signerData.claimAuthority as Address;

      // 3) Compute on-chain amounts in the token's native decimals.
      const amountPerClaimWei = parseUnits(String(amountNum), selectedToken.decimals);
      const maxClaimantsBig = BigInt(claimantsNum);
      const totalAmountWei = amountPerClaimWei * maxClaimantsBig;

      // 4) Set up the user's wallet client (passkey EOA).
      const account = privateKeyToAccount(privateKey);
      if (account.address.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('The unlocked key does not match this wallet.');
      }
      const rpc = ACTIVE_CHAIN.rpcUrls.default.http[0];
      const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(rpc) });
      const walletClient = createWalletClient({ account, chain: ACTIVE_CHAIN, transport: http(rpc) });

      dropId = dropIdSeed();
      const dropIdBytes32 = keccak256(toHex(dropId));

      // 5) Approve the DropClaim contract to pull the total drop amount.
      const allowance = await publicClient.readContract({
        address: selectedToken.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as Address, dropClaim],
      }).catch(() => BigInt(0));
      if (allowance < totalAmountWei) {
        const approveHash = await writeContractWithFee(walletClient, {
          account,
          address: selectedToken.address as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [dropClaim, totalAmountWei],
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        if (approveReceipt.status !== 'success') throw new Error('Token approval was not confirmed.');
      }

      // 6) Create the real on-chain drop (pulls totalAmount tokens into DropClaim).
      const nowSeconds = Math.floor(Date.now() / 1000);
      const hours = Number(endsIn) || 24;
      const createHash = await writeContractWithFee(walletClient, {
        account,
        address: dropClaim,
        abi: DROP_CREATE_ABI,
        functionName: 'createDrop',
        args: [
          dropIdBytes32,
          selectedToken.address as Address,
          totalAmountWei,
          amountPerClaimWei,
          maxClaimantsBig,
          BigInt(nowSeconds),
          BigInt(nowSeconds + hours * 3600),
          claimAuthority,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        ],
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      if (createReceipt.status !== 'success') throw new Error('The drop transaction was not confirmed on-chain.');

      // 7) Record the drop in the DB so it appears on the map (only after on-chain success).
      const now = Date.now();
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId,
          name: `${amountNum} ${selectedToken.symbol} drop`,
          description: `A ${selectedToken.symbol} drop near ${location.name}.`,
          tokenAddress: selectedToken.address,
          tokenSymbol: selectedToken.symbol,
          tokenName: selectedToken.name,
          tokenDecimals: selectedToken.decimals,
          amount: amountNum,
          maxClaimants: claimantsNum,
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + hours * 3600 * 1000).toISOString(),
          lat: location.lat,
          lng: location.lng,
          creatorAddress: walletAddress,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'The drop is live on-chain but could not be added to the map.');

      setPublishState('success');
      notify?.('Drop published on-chain and added to the map.');
      onCreated?.({
        id: data.drop?.id ?? dropId,
        lat: data.drop?.lat != null ? Number(data.drop.lat) : location.lat,
        lng: data.drop?.lng != null ? Number(data.drop.lng) : location.lng,
      });
    } catch (err) {
      setPublishState('error');
      setPublishError(err instanceof Error ? err.message : 'Could not create the drop.');
    } finally {
      setPublishing(false);
    }
  }

  function dropIdSeed(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `drop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function reset() {
    setStep('location');
    setLocation(null);
    setSearchTerm('');
    setSearchResults([]);
    setLocationError('');
    setAmount('');
    setPublishState('idle');
    setPublishError('');
  }

  function close() {
    reset();
    onClose();
  }

  const stepLabels: Record<Step, string> = {
    location: 'Where',
    token: 'Token',
    amount: 'Amount',
    review: 'Review',
  };

  return (
    <Sheet open={open} onClose={close} title="Create a drop">
      <div className="create-drop-flow">
        <div className="create-drop-steps" role="tablist" aria-label="Create drop steps">
          {(['location', 'token', 'amount', 'review'] as Step[]).map((s) => (
            <span key={s} className={`create-drop-step${step === s ? ' is-active' : ''}${stepIndex(s) < stepIndex(step) ? ' is-done' : ''}`}>
              {stepLabels[s]}
            </span>
          ))}
        </div>

        {!connected ? (
          <div className="drop-sheet-content create-drop-gate">
            <div className="drop-sheet-art"><span><Gift size={30} strokeWidth={2.2} /></span><i /><i /><i /></div>
            <p className="drop-sheet-copy">Create a passkey wallet to publish drops to the city map.</p>
            <button className="claim-button" onClick={() => { close(); onNeedWallet?.(); }}>Open wallet</button>
          </div>
        ) : (
          <>
            {step === 'location' && (
              <div className="create-drop-step-panel">
                <div className="create-drop-search-row">
                  <Search size={16} />
                  <input
                    className="create-drop-search"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); void doSearch(e.target.value); }}
                    placeholder="Search for a place or address"
                    aria-label="Search for a place or address"
                  />
                  {searchTerm && <button className="create-drop-clear" onClick={() => { setSearchTerm(''); setSearchResults([]); }} aria-label="Clear search"><X size={15} /></button>}
                </div>
                {searching && <p className="you-note">Searching…</p>}
                {searchResults.length > 0 && (
                  <ul className="create-drop-results">
                    {searchResults.map((r, i) => (
                      <li key={i}><button onClick={() => pickSearchResult(r)}><MapPin size={14} /> <span>{r.display_name}</span></button></li>
                    ))}
                  </ul>
                )}
                <div className="create-drop-map-wrap">
                  <div ref={mapContainer} className="create-drop-map" aria-label="Map to choose a drop location" />
                  <button className="create-drop-locate" onClick={useMyLocation} disabled={locating} aria-label="Use my location">
                    <LocateFixed size={16} /> {locating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>
                <p className="create-drop-map-hint">Tap the map or drag the green pin to set the drop location.</p>
                {location && <p className="create-drop-place"><MapPin size={14} /> {location.name}</p>}
                {locationError && <p className="you-error" role="alert">{locationError}</p>}
                <div className="create-drop-actions">
                  <button className="you-connect-primary" disabled={!canContinueLocation} onClick={() => setStep('token')}>
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 'token' && (
              <div className="create-drop-step-panel">
                <p className="wallet-send-caution">Choose a token you already own. Your balances are read live from {chainLabel}. No new token is deployed.</p>
                {tokensLoading ? (
                  <p className="you-note"><span className="spinner" /> Loading balances…</p>
                ) : tokens.length === 0 ? (
                  <div className="create-drop-empty">
                    <strong>No tokens found on this wallet.</strong>
                    <p>Add Celo Sepolia funds or import an ERC-20 in your wallet, then come back to drop it.</p>
                    <button className="you-connect-secondary" onClick={() => { close(); onNeedWallet?.(); }}>Open wallet</button>
                  </div>
                ) : (
                  <ul className="create-drop-token-list">
                    {tokens.map((t) => (
                      <li key={t.key}>
                        <button className={`create-drop-token${tokenKey === t.key ? ' is-selected' : ''}`} onClick={() => setTokenKey(t.key)}>
                          <span className="create-drop-token-mark">{t.symbol.slice(0, 1)}</span>
                          <span className="create-drop-token-info">
                            <strong>{t.symbol}</strong>
                            <small>{t.name} · {chainLabel}</small>
                          </span>
                          <span className="create-drop-token-balance">
                            <strong>{t.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong>
                            <small>{t.symbol}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="create-drop-actions">
                  <button className="you-connect-secondary" onClick={() => setStep('location')}><ArrowLeft size={16} /> Back</button>
                  <button className="you-connect-primary" disabled={!selectedToken} onClick={() => setStep('amount')}>Continue <ArrowRight size={16} /></button>
                </div>
              </div>
            )}

            {step === 'amount' && selectedToken && (
              <div className="create-drop-step-panel">
                <label className="wallet-field-label" htmlFor="create-drop-amount">Amount per person · available {selectedToken.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</label>
                <div className="wallet-send-amount-row">
                  <input id="create-drop-amount" className="you-passphrase" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                  <button className="create-drop-max" onClick={() => setAmount(String(selectedToken.balance))}>MAX</button>
                </div>
                <div className="wallet-send-amount-row">
                  <div style={{ flex: 1 }}>
                    <label className="wallet-field-label" htmlFor="create-drop-claimants">Max claimants</label>
                    <input id="create-drop-claimants" className="you-passphrase" value={maxClaimants} onChange={(e) => setMaxClaimants(e.target.value.replace(/\D/g, ''))} placeholder="100" inputMode="numeric" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="wallet-field-label" htmlFor="create-drop-ends">Ends in (hours)</label>
                    <input id="create-drop-ends" className="you-passphrase" value={endsIn} onChange={(e) => setEndsIn(e.target.value.replace(/\D/g, ''))} placeholder="24" inputMode="numeric" />
                  </div>
                </div>
                {amountNum > 0 && <p className="create-drop-total">Total to allocate: <strong>{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedToken.symbol}</strong> · {chainLabel}</p>}
                {amountError && <p className="you-error" role="alert">{amountError}</p>}
                <div className="create-drop-actions">
                  <button className="you-connect-secondary" onClick={() => setStep('token')}><ArrowLeft size={16} /> Back</button>
                  <button className="you-connect-primary" disabled={!amountValid} onClick={() => setStep('review')}>Review <ArrowRight size={16} /></button>
                </div>
              </div>
            )}

            {step === 'review' && selectedToken && location && (
              <div className="create-drop-step-panel">
                <div className="create-drop-review">
                  <div className="create-drop-review-row"><span>Location</span><strong><MapPin size={13} /> {location.name}</strong></div>
                  <div className="create-drop-review-row"><span>Token</span><strong>{selectedToken.symbol} · {selectedToken.name}</strong></div>
                  <div className="create-drop-review-row"><span>Network</span><strong>{chainLabel}</strong></div>
                  <div className="create-drop-review-row"><span>Amount per person</span><strong>{amountNum} {selectedToken.symbol}</strong></div>
                  <div className="create-drop-review-row"><span>Max claimants</span><strong>{claimantsNum}</strong></div>
                  <div className="create-drop-review-row"><span>Total to allocate</span><strong>{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedToken.symbol}</strong></div>
                  <div className="create-drop-review-row"><span>Duration</span><strong>{endsIn || 24} hours</strong></div>
                </div>
                <p className="wallet-send-caution">Publishing signs a real transaction: it approves and funds the on-chain DropClaim contract with your {selectedToken.symbol}, then records the drop on the map. Your tokens are locked for claims.</p>
                <FeePreview quote={publishFee.quote} error={publishFee.error} loading={publishFee.loading} />

                {needsUnlock && (
                  <div className="wallet-unlock">
                    <p>Enter your 6-digit wallet PIN to sign this transaction.</p>
                    <PinBoxes id="create-drop-pin" value={pin} onChange={(next) => { setPin(next); setUnlockError(''); }} />
                    {unlockError && <p className="you-error" role="alert">{unlockError}</p>}
                  </div>
                )}

                {publishState === 'pending' && <p className="you-note"><span className="spinner" /> Approving and funding your drop on-chain…</p>}
                {publishState === 'success' && (
                  <div className="create-drop-success">
                    <p>Your drop is live on the map.</p>
                    <button className="claim-button is-claimed" onClick={close}>Back to the city</button>
                  </div>
                )}
                {publishState === 'error' && <p className="you-error" role="alert">{publishError}</p>}

                {publishState !== 'success' && (
                  <div className="create-drop-actions">
                    <button className="you-connect-secondary" onClick={() => setStep('amount')}><ArrowLeft size={16} /> Back</button>
                    <button className="claim-button" disabled={publishing || publishState === 'pending' || Boolean(publishFee.error)} onClick={() => void publish()}>
                      <Gift size={16} /> {publishing ? 'Publishing…' : 'Publish drop'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function stepIndex(s: Step): number {
  return ['location', 'token', 'amount', 'review'].indexOf(s);
}
