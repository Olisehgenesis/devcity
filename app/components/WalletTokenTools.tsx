'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, CirclePlus, Copy, ExternalLink, RefreshCw, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoSepolia } from 'viem/chains';
import {
  clearUnlockedWallet,
  rememberUnlockedWallet,
} from '@/lib/unlocked-wallet';
import {
  decryptWithPassphrase,
  loadLocalWallet,
  type LocalWallet,
} from '@/lib/keystore';
import { writeContractWithFee, type TxRequest } from '@/lib/gas';
import { useFeeQuote } from '../hooks/useFeeQuote';
import { useUnlockedKey } from '../hooks/useUnlockedKey';
import { FeePreview } from './wallet/FeePreview';
import { UnlockSecret } from './PinBoxes';
import {
  getImportedWalletTokens,
  removeImportedWalletToken,
  saveImportedWalletToken,
  type ImportedWalletToken,
} from '@/lib/wallet-assets';
import { CELO_SEPOLIA, ERC20_ABI, POOL_MANAGER_ABI } from '@/lib/chain';

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'createToken', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'symbol', type: 'string' }, { name: 'tokenURI', type: 'string' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'supportsPriceAwarePoolLaunch', stateMutability: 'pure', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'createPoolAndAddLiquidityAtPrice', stateMutability: 'nonpayable', inputs: [{ name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' }, { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' }, { name: 'initialSqrtPriceX96', type: 'uint160' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'poolId', type: 'bytes32' }] },
  { type: 'function', name: 'addLiquidity', stateMutability: 'nonpayable', inputs: [{ name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' }, { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }, { name: 'liquidity', type: 'uint128' }] },
] as const;

const PROFILE_TOKEN_ABI = [
  ...ERC20_ABI,
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'setTokenURI', stateMutability: 'nonpayable', inputs: [{ name: 'tokenURI', type: 'string' }], outputs: [] },
  { type: 'function', name: 'poolId', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'poolCreated', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'tip', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'buyWithUSDT', stateMutability: 'nonpayable', inputs: [{ name: 'usdtAmountIn', type: 'uint256' }, { name: 'minTokensOut', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'tokensReceived', type: 'uint256' }] },
  { type: 'function', name: 'sellForUSDT', stateMutability: 'nonpayable', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'minUSDTOut', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'usdtReceived', type: 'uint256' }] },
] as const;

const SEPOLIA_USDT = CELO_SEPOLIA.usdt as Address;
const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(CELO_SEPOLIA.rpcUrl),
});
const mainnetPublicClient = createPublicClient({
  chain: celo,
  transport: http(celo.rpcUrls.default.http[0]),
});

function marketClient(chainId: number) {
  if (chainId === celo.id) return mainnetPublicClient;
  if (chainId === celoSepolia.id) return publicClient;
  throw new Error('Token imports are only supported on Celo and Celo Sepolia.');
}

function integerSqrt(value: bigint): bigint {
  if (value < BigInt(0)) throw new Error('Cannot calculate a square root for a negative value.');
  if (value < BigInt(2)) return value;
  let estimate = value / BigInt(2);
  let next = (estimate + value / estimate) / BigInt(2);
  while (next < estimate) {
    estimate = next;
    next = (estimate + value / estimate) / BigInt(2);
  }
  return estimate;
}

function sqrtPriceX96FromAmounts(amount0: bigint, amount1: bigint): bigint {
  if (amount0 <= BigInt(0) || amount1 <= BigInt(0)) throw new Error('Both liquidity amounts must be greater than zero.');
  const q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceX96 = integerSqrt((amount1 * q96 * q96) / amount0);
  if (sqrtPriceX96 <= BigInt('4295128739') || sqrtPriceX96 >= BigInt('1461446703485210103287273052203988822378723970342')) {
    throw new Error('That starting price is outside Uniswap V4’s supported range.');
  }
  return sqrtPriceX96;
}

function minimumOutFromSpot(inputAmount: bigint, tokenPrice: number, tokenDecimals: number, isBuy: boolean): bigint {
  if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) throw new Error('A live pool price is needed to estimate this trade.');
  const priceScale = BigInt(10) ** BigInt(12);
  const scaledPrice = BigInt(Math.floor(tokenPrice * Number(priceScale)));
  if (scaledPrice <= BigInt(0)) throw new Error('The current pool price is too small to estimate this trade.');
  const tokenScale = BigInt(10) ** BigInt(tokenDecimals);
  const usdtScale = BigInt(10) ** BigInt(6);
  const expected = isBuy
    ? (inputAmount * tokenScale * priceScale) / (usdtScale * scaledPrice)
    : (inputAmount * scaledPrice * usdtScale) / (tokenScale * priceScale);
  const minimum = (expected * BigInt(9_500)) / BigInt(10_000);
  if (minimum <= BigInt(0)) throw new Error('Trade amount is too small to estimate a minimum receive amount.');
  return minimum;
}

function isAllowedTokenURI(uri: string) {
  return uri.length <= 2048 && (!uri || uri.startsWith('https://') || uri.startsWith('ipfs://'));
}

interface TokenPrice {
  priceUsd: number | null;
  liquidityUsd?: number | null;
  source?: string | null;
  fetchedAt?: string;
}

interface ProfileTokenDetails {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  treasuryBalance: bigint;
  totalSupply: bigint;
  tokenURI: string;
  poolCreated: boolean;
  price: number | null;
  priceSource: string | null;
}

interface WalletTokenToolsProps {
  wallet: LocalWallet;
  username: string;
  assetChainId: number;
  assetChainLabel: string;
  unlockedKey: Hex | null;
  onUnlockKey: (privateKey: Hex) => void;
  onTokensChange: (tokens: ImportedWalletToken[]) => void;
  notify?: (message: string) => void;
  /** Limit this panel to one job. Omit it to keep the in-panel Assets / Profile token switch. */
  focus?: 'assets' | 'profile' | 'trade';
  onSelectImported?: (token: ImportedWalletToken, balanceLabel: string, valueLabel: string) => void;
  /** Increments when the wallet asks this panel to open token import. */
  importSignal?: number;
  /** The holdings header already offers Add a token. */
  addExternal?: boolean;
}

export function WalletTokenTools({ wallet, username, assetChainId, assetChainLabel, unlockedKey, onUnlockKey, onTokensChange, notify, focus, onSelectImported, importSignal = 0, addExternal = false }: WalletTokenToolsProps) {
  const [tab, setTab] = useState<'assets' | 'profile-token'>('assets');
  const [tokens, setTokens] = useState<ImportedWalletToken[]>([]);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [profileToken, setProfileToken] = useState<ProfileTokenDetails | null>(null);
  const [profileAction, setProfileAction] = useState<'send' | 'trade' | 'liquidity'>('send');
  const [profileStats, setProfileStats] = useState<{ icon?: string; totalSupplyFormatted?: number } | null>(null);
  const [priceAwareFactory, setPriceAwareFactory] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importAddress, setImportAddress] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [editTokenURI, setEditTokenURI] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [buyUsdtAmount, setBuyUsdtAmount] = useState('');
  const [sellTokenAmount, setSellTokenAmount] = useState('');
  const [liquidityTokenAmount, setLiquidityTokenAmount] = useState('');
  const [liquidityUsdtAmount, setLiquidityUsdtAmount] = useState('');
  const [pin, setPin] = useState('');
  const [operation, setOperation] = useState<'import' | 'launch' | 'tip' | 'buy' | 'sell' | 'update-uri' | 'liquidity' | null>(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (importSignal > 0) setImportOpen(true);
  }, [importSignal]);

  const normalizedUsername = useMemo(
    () => username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'CITY',
    [username],
  );
  const initialPricePreview = Number(liquidityUsdtAmount) / Number(liquidityTokenAmount);
  const launchFeeRequest = useMemo<TxRequest | null>(() => {
    if (profileToken) return null;
    const name = (tokenName.trim() || `${username || 'Your name'}.devcity.fun`).slice(0, 32);
    const symbol = (tokenSymbol.trim() || normalizedUsername).toUpperCase();
    if (name.length < 2 || !/^[A-Z0-9]{2,10}$/.test(symbol)) return null;
    return {
      to: CELO_SEPOLIA.profileTokenFactory as Address,
      data: encodeFunctionData({ abi: PROFILE_FACTORY_ABI, functionName: 'createToken', args: [name, symbol, 'https://devcity.fun/token'] }),
    };
  }, [normalizedUsername, profileToken, tokenName, tokenSymbol, username]);
  const launchFee = useFeeQuote(wallet.address, launchFeeRequest);
  const tipFeeRequest = useMemo<TxRequest | null>(() => {
    if (!profileToken || !isAddress(recipient) || !tipAmount) return null;
    try {
      const amount = parseUnits(tipAmount, profileToken.decimals);
      if (amount <= BigInt(0)) return null;
      return {
        to: profileToken.address,
        data: encodeFunctionData({ abi: PROFILE_TOKEN_ABI, functionName: 'tip', args: [getAddress(recipient), amount] }),
      };
    } catch {
      return null;
    }
  }, [profileToken, recipient, tipAmount]);
  const tipFee = useFeeQuote(wallet.address, tipFeeRequest);
  const buyFeeRequest = useMemo<TxRequest | null>(() => {
    if (!profileToken?.poolCreated || !buyUsdtAmount) return null;
    try {
      const amount = parseUnits(buyUsdtAmount, 6);
      if (amount <= BigInt(0)) return null;
      return {
        to: profileToken.address,
        data: encodeFunctionData({ abi: PROFILE_TOKEN_ABI, functionName: 'buyWithUSDT', args: [amount, BigInt(0), BigInt(0)] }),
      };
    } catch {
      return null;
    }
  }, [buyUsdtAmount, profileToken]);
  const buyFee = useFeeQuote(wallet.address, buyFeeRequest);
  const sellFeeRequest = useMemo<TxRequest | null>(() => {
    if (!profileToken?.poolCreated || !sellTokenAmount) return null;
    try {
      const amount = parseUnits(sellTokenAmount, profileToken.decimals);
      if (amount <= BigInt(0)) return null;
      return {
        to: profileToken.address,
        data: encodeFunctionData({ abi: PROFILE_TOKEN_ABI, functionName: 'sellForUSDT', args: [amount, BigInt(0), BigInt(0)] }),
      };
    } catch {
      return null;
    }
  }, [profileToken, sellTokenAmount]);
  const sellFee = useFeeQuote(wallet.address, sellFeeRequest);

  const loadTokens = useCallback(async () => {
    setError('');
    try {
      const imported = getImportedWalletTokens(wallet.address, assetChainId);
      setTokens(imported);
      onTokensChange(imported);
      const assetsClient = marketClient(assetChainId);
      const nextBalances: Record<string, bigint> = {};
      await Promise.all(imported.map(async (token) => {
        try {
          nextBalances[token.address.toLowerCase()] = await assetsClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [wallet.address as Address],
          });
        } catch (readError) {
          setError(readError instanceof Error ? `Could not read ${token.symbol} balance: ${readError.message}` : `Could not read ${token.symbol} balance.`);
        }
      }));
      setBalances((previous) => ({ ...previous, ...nextBalances }));
      const nextPrices: Record<string, TokenPrice> = {};
      await Promise.all(imported.map(async (token) => {
        try {
          const response = await fetch(`/api/token-price?address=${encodeURIComponent(token.address)}&chainId=${assetChainId}`);
          if (!response.ok) throw new Error('Price data could not be loaded.');
          nextPrices[token.address.toLowerCase()] = await response.json() as TokenPrice;
        } catch {
          nextPrices[token.address.toLowerCase()] = { priceUsd: null };
        }
      }));
      setPrices((previous) => ({ ...previous, ...nextPrices }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your imported tokens.');
    }
  }, [assetChainId, onTokensChange, wallet.address]);

  const loadProfileToken = useCallback(async () => {
    try {
      const address = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'getUserToken',
        args: [wallet.address as Address],
      });
      if (address.toLowerCase() === zeroAddress) return false;

      const [name, symbol, decimals, totalSupply, balance, treasuryBalance, uri] = await Promise.all([
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [wallet.address as Address] }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [CELO_SEPOLIA.profileTokenFactory as Address] }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'tokenURI' }),
      ]);
      let poolCreated = false;
      try {
        poolCreated = await publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'poolCreated' });
      } catch {
        poolCreated = false;
      }
      let price: number | null = null;
      let priceSource: string | null = null;
      if (poolCreated) {
        const poolId = await publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'poolId' });
        const slot = await publicClient.readContract({
          address: CELO_SEPOLIA.poolManager as Address,
          abi: POOL_MANAGER_ABI,
          functionName: 'getSlot0',
          args: [poolId],
        });
        const sqrt = Number(slot[0]) / 2 ** 96;
        const rawRatio = sqrt * sqrt;
        const tokenIsCurrency0 = address.toLowerCase() < SEPOLIA_USDT.toLowerCase();
        const tokenPrice = tokenIsCurrency0
          ? rawRatio * 10 ** (Number(decimals) - 6)
          : 1 / (rawRatio * 10 ** (6 - Number(decimals)));
        if (Number.isFinite(tokenPrice) && tokenPrice > 0) {
          price = tokenPrice;
          priceSource = 'Uniswap V4 · Celo Sepolia';
        }
      }
      setProfileToken({
        address,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply,
        balance,
        treasuryBalance,
        tokenURI: uri,
        poolCreated,
        price,
        priceSource,
      });
      setEditTokenURI(uri);
      return true;
    } catch (readError) {
      setError(readError instanceof Error ? `Could not load your profile token: ${readError.message}` : 'Could not load your profile token.');
      return false;
    }
  }, [wallet.address]);

  const checkFactoryCapability = useCallback(async () => {
    try {
      const supported = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'supportsPriceAwarePoolLaunch',
      });
      setPriceAwareFactory(supported);
    } catch {
      setPriceAwareFactory(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens();
    void loadProfileToken();
    void checkFactoryCapability();
  }, [checkFactoryCapability, loadProfileToken, loadTokens]);

  useEffect(() => {
    if (!profileToken?.address) {
      setProfileStats(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/token-stats?address=${encodeURIComponent(profileToken.address)}&chainId=${assetChainId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.icon === 'string') {
          setProfileStats({ icon: data.icon, totalSupplyFormatted: data.totalSupplyFormatted });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [assetChainId, profileToken?.address]);

  useEffect(() => {
    if (!tokenName && username) setTokenName(`${username.replace(/[^a-zA-Z0-9-]/g, '')}.devcity.fun`);
    if (!tokenSymbol && normalizedUsername !== 'CITY') setTokenSymbol(normalizedUsername);
  }, [normalizedUsername, tokenName, tokenSymbol, username]);

  const sessionKey = useUnlockedKey(wallet.address);
  const signingKey = unlockedKey ?? sessionKey;

  const ensureUnlocked = async (): Promise<Hex> => {
    if (signingKey) return signingKey;
    if (wallet.pinProtected && !/^\d{6}$/.test(pin)) throw new Error('Enter your 6-digit wallet PIN to approve this transaction.');
    if (!pin) throw new Error('Enter your wallet passphrase to approve this transaction.');
    const storedWallet = await loadLocalWallet(wallet.address);
    if (!storedWallet) throw new Error('Wallet key is not available on this device.');
    const privateKey = (await decryptWithPassphrase(pin, storedWallet.encryptedPrivateKey)) as Hex;
    onUnlockKey(privateKey);
    rememberUnlockedWallet(wallet.address, privateKey);
    setPin('');
    return privateKey;
  };

  const walletClient = async () => {
    const privateKey = await ensureUnlocked();
    const account = privateKeyToAccount(privateKey);
    if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
      clearUnlockedWallet();
      throw new Error('The unlocked key does not match this wallet address.');
    }
    return createWalletClient({ account, chain: celoSepolia, transport: http(CELO_SEPOLIA.rpcUrl) });
  };

  const waitForSuccess = async (hash: Hex) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${CELO_SEPOLIA.blockExplorer}/tx/${hash}`);
    setTransactionHash(hash);
  };

  const importToken = async () => {
    if (!isAddress(importAddress)) {
      setError(`Enter a valid ${assetChainLabel} token contract address.`);
      return;
    }
    setOperation('import');
    setError('');
    try {
      const address = getAddress(importAddress);
      const assetsClient = marketClient(assetChainId);
      const [name, symbol, decimals] = await Promise.all([
        assetsClient.readContract({ address, abi: ERC20_ABI, functionName: 'name' }),
        assetsClient.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
        assetsClient.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
      ]);
      const token = { address, name: name.slice(0, 64), symbol: symbol.slice(0, 16), decimals: Number(decimals), chainId: assetChainId };
      saveImportedWalletToken(wallet.address, assetChainId, token);
      setImportAddress('');
      setImportOpen(false);
      await loadTokens();
      notify?.(`${token.symbol} added to your wallet.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Token could not be added.');
    } finally {
      setOperation(null);
    }
  };

  const launchToken = async () => {
    const name = tokenName.trim();
    const symbol = tokenSymbol.trim().toUpperCase();
    if (name.length < 2 || name.length > 32) {
      setError('Token name must be between 2 and 32 characters.');
      return;
    }
    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) {
      setError('Use 2–10 letters or numbers for the token symbol.');
      return;
    }
    const uri = `${window.location.origin}/api/token-icon?owner=${wallet.address}&chainId=${assetChainId}`;
    setOperation('launch');
    setError('');
    setTransactionHash('');
    try {
      const client = await walletClient();
      const hash = await writeContractWithFee(client, {
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'createToken',
        args: [name, symbol, uri],
      });
      await waitForSuccess(hash);
      setTransactionHash('');
      setProfileToken({
        address: zeroAddress,
        name,
        symbol,
        decimals: 18,
        balance: parseUnits('900000', 18),
        treasuryBalance: parseUnits('100000', 18),
        totalSupply: parseUnits('1000000', 18),
        tokenURI: uri,
        poolCreated: false,
        price: null,
        priceSource: null,
      });
      let found = false;
      for (let attempt = 0; attempt < 4 && !found; attempt += 1) {
        found = await loadProfileToken();
        if (!found) await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setError('');
      const contractAddress = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'getUserToken',
        args: [wallet.address as Address],
      });
      if (contractAddress && contractAddress.toLowerCase() !== zeroAddress) {
        await fetch('/api/profile-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorAddress: wallet.address,
            name,
            symbol,
            contractAddress,
            chainId: assetChainId,
            maxSupply: '1000000',
          }),
        });
      }
      notify?.(`${symbol} profile token launched on Celo Sepolia.`);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : 'Profile token launch failed.');
    } finally {
      setOperation(null);
    }
  };

  const tipProfileToken = async () => {
    if (!profileToken) return;
    if (!isAddress(recipient)) {
      setError('Enter a valid wallet address for the recipient.');
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(tipAmount, profileToken.decimals);
    } catch {
      setError('Enter a valid token amount.');
      return;
    }
    if (amount <= BigInt(0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (amount > profileToken.balance) {
      setError(`You have ${formatUnits(profileToken.balance, profileToken.decimals)} ${profileToken.symbol} available.`);
      return;
    }
    setOperation('tip');
    setError('');
    setTransactionHash('');
    try {
      const client = await walletClient();
      const hash = await writeContractWithFee(client, {
        address: profileToken.address,
        abi: PROFILE_TOKEN_ABI,
        functionName: 'tip',
        args: [getAddress(recipient), amount],
      });
      await waitForSuccess(hash);
      setRecipient('');
      setTipAmount('');
      await loadProfileToken();
      notify?.(`Sent ${formatUnits(amount, profileToken.decimals)} ${profileToken.symbol}.`);
    } catch (tipError) {
      setError(tipError instanceof Error ? tipError.message : 'Token transfer failed.');
    } finally {
      setOperation(null);
    }
  };

  const buyProfileToken = async () => {
    if (!profileToken || !profileToken.poolCreated) return;
    let amountIn: bigint;
    try {
      amountIn = parseUnits(buyUsdtAmount, 6);
      if (amountIn <= BigInt(0)) throw new Error('Enter a USDT amount greater than zero.');
    } catch (buyError) {
      setError(buyError instanceof Error ? buyError.message : 'Enter a valid USDT amount.');
      return;
    }
    setOperation('buy');
    setError('');
    setTransactionHash('');
    try {
      const [usdtBalance, allowance] = await Promise.all([
        publicClient.readContract({ address: SEPOLIA_USDT, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet.address as Address] }),
        publicClient.readContract({ address: SEPOLIA_USDT, abi: ERC20_ABI, functionName: 'allowance', args: [wallet.address as Address, profileToken.address] }),
      ]);
      if (usdtBalance < amountIn) throw new Error('Not enough Celo Sepolia USDT in this wallet.');
      const minimumTokensOut = minimumOutFromSpot(amountIn, profileToken.price ?? 0, profileToken.decimals, true);
      const client = await walletClient();
      if (allowance < amountIn) {
        const approval = await writeContractWithFee(client, {
          address: SEPOLIA_USDT,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [profileToken.address, amountIn],
        });
        await waitForSuccess(approval);
      }
      const hash = await writeContractWithFee(client, {
        address: profileToken.address,
        abi: PROFILE_TOKEN_ABI,
        functionName: 'buyWithUSDT',
        args: [amountIn, minimumTokensOut, BigInt(Math.floor(Date.now() / 1000) + 900)],
      });
      await waitForSuccess(hash);
      setBuyUsdtAmount('');
      await loadProfileToken();
      notify?.(`Bought ${profileToken.symbol} with USDT.`);
    } catch (buyError) {
      setError(buyError instanceof Error ? buyError.message : 'Token purchase failed.');
    } finally {
      setOperation(null);
    }
  };

  const sellProfileToken = async () => {
    if (!profileToken || !profileToken.poolCreated) return;
    let amountIn: bigint;
    try {
      amountIn = parseUnits(sellTokenAmount, profileToken.decimals);
      if (amountIn <= BigInt(0)) throw new Error('Enter a token amount greater than zero.');
    } catch (sellError) {
      setError(sellError instanceof Error ? sellError.message : 'Enter a valid token amount.');
      return;
    }
    if (amountIn > profileToken.balance) {
      setError(`You have ${formatUnits(profileToken.balance, profileToken.decimals)} ${profileToken.symbol} available.`);
      return;
    }
    setOperation('sell');
    setError('');
    setTransactionHash('');
    try {
      const minimumUsdtOut = minimumOutFromSpot(amountIn, profileToken.price ?? 0, profileToken.decimals, false);
      const client = await walletClient();
      const hash = await writeContractWithFee(client, {
        address: profileToken.address,
        abi: PROFILE_TOKEN_ABI,
        functionName: 'sellForUSDT',
        args: [amountIn, minimumUsdtOut, BigInt(Math.floor(Date.now() / 1000) + 900)],
      });
      await waitForSuccess(hash);
      setSellTokenAmount('');
      await loadProfileToken();
      notify?.(`Sold ${profileToken.symbol} for USDT.`);
    } catch (sellError) {
      setError(sellError instanceof Error ? sellError.message : 'Token sale failed.');
    } finally {
      setOperation(null);
    }
  };

  const updateTokenURI = async () => {
    if (!profileToken) return;
    if (!isAllowedTokenURI(editTokenURI.trim())) {
      setError('Use an https:// or ipfs:// token details URL, up to 2,048 characters.');
      return;
    }
    setOperation('update-uri');
    setError('');
    setTransactionHash('');
    try {
      const client = await walletClient();
      const hash = await writeContractWithFee(client, {
        address: profileToken.address,
        abi: PROFILE_TOKEN_ABI,
        functionName: 'setTokenURI',
        args: [editTokenURI.trim()],
      });
      await waitForSuccess(hash);
      await loadProfileToken();
      notify?.('Profile token details updated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Token details could not be updated.');
    } finally {
      setOperation(null);
    }
  };

  const provideLiquidity = async () => {
    if (!profileToken) return;
    const isInitialPool = !profileToken.poolCreated;
    if (isInitialPool && !priceAwareFactory) {
      setError('The deployed factory does not yet support safe price-aware pool creation.');
      return;
    }
    let tokenAmount: bigint;
    let usdtAmount: bigint;
    let amount0: bigint;
    let amount1: bigint;
    let initialSqrtPriceX96 = BigInt(0);
    try {
      tokenAmount = parseUnits(liquidityTokenAmount, profileToken.decimals);
      usdtAmount = parseUnits(liquidityUsdtAmount, 6);
      const profileTokenIsCurrency0 = profileToken.address.toLowerCase() < SEPOLIA_USDT.toLowerCase();
      amount0 = profileTokenIsCurrency0 ? tokenAmount : usdtAmount;
      amount1 = profileTokenIsCurrency0 ? usdtAmount : tokenAmount;
      if (isInitialPool) initialSqrtPriceX96 = sqrtPriceX96FromAmounts(amount0, amount1);
    } catch {
      setError('Enter valid liquidity amounts and a starting price inside the Uniswap V4 range.');
      return;
    }
    if (tokenAmount <= BigInt(0) || usdtAmount <= BigInt(0)) {
      setError('Both liquidity amounts must be greater than zero.');
      return;
    }
    setOperation('liquidity');
    setError('');
    setTransactionHash('');
    try {
      const [tokenBalance, usdtBalance] = await Promise.all([
        publicClient.readContract({ address: profileToken.address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [wallet.address as Address] }),
        publicClient.readContract({ address: SEPOLIA_USDT, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet.address as Address] }),
      ]);
      if (tokenBalance < tokenAmount) throw new Error(`Not enough ${profileToken.symbol} in this wallet.`);
      if (usdtBalance < usdtAmount) throw new Error('Not enough Celo Sepolia USDT in this wallet.');
      const client = await walletClient();
      const factory = CELO_SEPOLIA.profileTokenFactory as Address;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
      const [tokenAllowance, usdtAllowance] = await Promise.all([
        publicClient.readContract({ address: profileToken.address, abi: ERC20_ABI, functionName: 'allowance', args: [wallet.address as Address, factory] }),
        publicClient.readContract({ address: SEPOLIA_USDT, abi: ERC20_ABI, functionName: 'allowance', args: [wallet.address as Address, factory] }),
      ]);
      if (tokenAllowance < tokenAmount) {
        const tokenApproval = await writeContractWithFee(client, {
          address: profileToken.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [factory, tokenAmount],
        });
        await waitForSuccess(tokenApproval);
      }
      if (usdtAllowance < usdtAmount) {
        const usdtApproval = await writeContractWithFee(client, {
          address: SEPOLIA_USDT,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [factory, usdtAmount],
        });
        await waitForSuccess(usdtApproval);
      }
      const hash = isInitialPool
        ? await writeContractWithFee(client, {
          address: factory,
          abi: PROFILE_FACTORY_ABI,
          functionName: 'createPoolAndAddLiquidityAtPrice',
          args: [amount0, amount1, BigInt(0), BigInt(0), initialSqrtPriceX96, deadline],
        })
        : await writeContractWithFee(client, {
          address: factory,
          abi: PROFILE_FACTORY_ABI,
          functionName: 'addLiquidity',
          args: [amount0, amount1, BigInt(0), BigInt(0), deadline],
        });
      await waitForSuccess(hash);
      setLiquidityTokenAmount('');
      setLiquidityUsdtAmount('');
      await loadProfileToken();
      notify?.(isInitialPool ? 'Your Uniswap V4 pool is live.' : 'Liquidity added to your Uniswap V4 pool.');
    } catch (liquidityError) {
      setError(liquidityError instanceof Error ? liquidityError.message : 'Liquidity could not be added.');
    } finally {
      setOperation(null);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      setError(copyError instanceof Error ? `Could not copy address: ${copyError.message}` : 'Could not copy the address.');
    }
  };

  const showAssets = focus === 'assets' || (focus == null && tab === 'assets');
  const showProfile = focus === 'profile' || focus === 'trade' || (focus == null && tab === 'profile-token');

  return (
    <section className="wallet-token-tools" aria-label="Token wallet tools">
      {focus == null && (
        <nav className="wallet-token-tabs" aria-label="Wallet token sections">
          <button className={tab === 'assets' ? 'is-active' : ''} onClick={() => setTab('assets')}>Assets</button>
          <button className={tab === 'profile-token' ? 'is-active' : ''} onClick={() => setTab('profile-token')}>Profile token</button>
        </nav>
      )}

      {showAssets ? (
        <section className="wallet-token-portfolio">
          {focus !== 'assets' && (
            <div className="wallet-section-heading wallet-assets-heading">
              <div><h3>Other tokens</h3><span>On {assetChainLabel} · stored on this device</span></div>
              <Button variant="outline" onClick={() => { setImportOpen(true); setError(''); }}><CirclePlus size={16} /> Import</Button>
            </div>
          )}
          {tokens.length === 0 ? (
            focus === 'assets' ? (
              !importOpen && !addExternal && <Button type="button" variant="outline" onClick={() => { setImportOpen(true); setError(''); }}>Add a token</Button>
            ) : (
            <div className="wallet-token-empty">
              <strong>Keep your tokens together.</strong>
              <p>Import an ERC-20 contract address to see its on-chain balance and market data where Celo markets are indexed.</p>
            </div>
            )
          ) : (
            <div className="wallet-token-list">
              {tokens.map((token) => {
                const price = prices[token.address.toLowerCase()];
                const balance = balances[token.address.toLowerCase()] ?? BigInt(0);
                const value = price?.priceUsd == null ? null : Number(formatUnits(balance, token.decimals)) * price.priceUsd;
                return (
                  <article className="wallet-token-row wallet-imported-token" key={token.address}>
                    <button
                      type="button"
                      className="wallet-token-open"
                      onClick={() => onSelectImported?.(
                        token,
                        Number(formatUnits(balance, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 5 }),
                        value == null ? 'Price unavailable' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                      )}
                    >
                      <span className="wallet-token-mark">{token.symbol.slice(0, 1)}</span>
                      <span className="wallet-token-name">
                        <strong>{token.symbol}</strong>
                        <small>{token.name} · {token.address.slice(0, 6)}…{token.address.slice(-4)}</small>
                      </span>
                      <span className="wallet-token-balance">
                        <strong>{Number(formatUnits(balance, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 5 })}</strong>
                        <small>{value == null ? 'Price unavailable' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</small>
                      </span>
                    </button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      aria-label={`Remove ${token.symbol} from wallet list`}
                      onClick={() => {
                        try {
                          removeImportedWalletToken(wallet.address, assetChainId, token.address);
                          setTokens((current) => {
                            const remaining = current.filter((item) => item.address !== token.address);
                            onTokensChange(remaining);
                            return remaining;
                          });
                        } catch (removeError) {
                          setError(removeError instanceof Error ? removeError.message : 'Token could not be removed.');
                        }
                      }}
                    ><X size={15} /></Button>
                    {price?.source && <small className="wallet-token-source">{price.source}{price.liquidityUsd ? ` · $${Math.round(price.liquidityUsd).toLocaleString()} pool liquidity` : ''}</small>}
                  </article>
                );
              })}
            </div>
          )}
          {importOpen && (
            <div className="wallet-action-panel wallet-token-import-panel">
              <div className="wallet-section-heading"><h3>Import an ERC-20</h3><Button variant="outline" size="icon" className="rounded-full" onClick={() => setImportOpen(false)} aria-label="Close token import"><X size={16} /></Button></div>
              <label className="wallet-field-label" htmlFor="wallet-import-token-address">Contract address</label>
              <input
                id="wallet-import-token-address"
                className="you-passphrase"
                value={importAddress}
                onChange={(event) => setImportAddress(event.target.value)}
                placeholder="0x…"
                autoComplete="off"
              />
              <p className="wallet-send-caution">Only import contracts you trust. A token name or symbol does not prove that a token is legitimate.</p>
              <Button disabled={operation === 'import' || !importAddress} onClick={() => void importToken()}>
                {operation === 'import' ? 'Checking contract…' : 'Add token'}
              </Button>
            </div>
          )}
          {focus === 'assets' && tokens.length > 0 && !importOpen && !addExternal && (
            <Button type="button" variant="outline" onClick={() => { setImportOpen(true); setError(''); }}>Add a token</Button>
          )}
          {focus !== 'assets' && (
            <Button variant="outline" onClick={() => void loadTokens()}><RefreshCw size={14} /> Refresh balances and prices</Button>
          )}
        </section>
      ) : showProfile ? (
        <section className="wallet-profile-token">
          {!profileToken ? (
            focus === 'trade' ? (
              <p className="you-note">No profile token yet. Initialise one from the wallet home.</p>
            ) : (
            <div className="winit">
              <h3>Initialise profile token</h3>
              <p>This mints a fixed supply on Celo Sepolia and ties it to this wallet. It is not real-world money. The name comes from your handle.</p>
              <dl className="winit-terms">
                <div><dt>Minted</dt><dd>1,000,000</dd></div>
                <div><dt>To you</dt><dd>900,000</dd></div>
                <div><dt>Treasury</dt><dd>100,000</dd></div>
              </dl>
              <p className="winit-note">After initialise, you can seed a Uniswap pool from this screen when the factory allows it. Seeding stays off while a new pool would open at a fixed 1:1 price.</p>
              {!signingKey && (
                <div className="wallet-unlock">
                  <p>Unlock to initialise this profile token.</p>
                  <UnlockSecret id="profile-token-pin" pinProtected={wallet.pinProtected} value={pin} onChange={setPin} />
                </div>
              )}
              <Button type="button" className="w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={operation === 'launch' || Boolean(launchFee.error)} onClick={() => void launchToken()}>
                {operation === 'launch' ? 'Initialising…' : 'Initialise profile token'}
              </Button>
              <FeePreview quote={launchFee.quote} error={launchFee.error} loading={launchFee.loading} />
            </div>
            )
          ) : (
            <>
              <ProfileTokenPage
                token={profileToken}
                iconSrc={profileIconSrc(profileToken, profileStats?.icon)}
                chainLabel={assetChainLabel}
                explorerBase={assetChainId === celo.id ? (celo.blockExplorers?.default.url ?? CELO_SEPOLIA.blockExplorer) : CELO_SEPOLIA.blockExplorer}
                copied={copied}
                onCopy={() => void copyAddress(profileToken.address)}
                action={profileAction}
                onAction={setProfileAction}
                poolReady={profileToken.poolCreated}
                canSeed={priceAwareFactory}
                recipient={recipient}
                onRecipient={setRecipient}
                tipAmount={tipAmount}
                onTipAmount={setTipAmount}
                buyUsdtAmount={buyUsdtAmount}
                onBuyUsdtAmount={setBuyUsdtAmount}
                sellTokenAmount={sellTokenAmount}
                onSellTokenAmount={setSellTokenAmount}
                liquidityTokenAmount={liquidityTokenAmount}
                onLiquidityTokenAmount={setLiquidityTokenAmount}
                liquidityUsdtAmount={liquidityUsdtAmount}
                onLiquidityUsdtAmount={setLiquidityUsdtAmount}
                onUseDefaults={() => { setLiquidityTokenAmount('1000'); setLiquidityUsdtAmount('10'); setError(''); }}
                initialPricePreview={initialPricePreview}
                signingKey={Boolean(signingKey)}
                pinProtected={wallet.pinProtected}
                pin={pin}
                onPin={setPin}
                operation={operation}
                tipFee={tipFee}
                buyFee={buyFee}
                sellFee={sellFee}
                editTokenURI={editTokenURI}
                onEditTokenURI={setEditTokenURI}
                transactionHash={transactionHash}
                onTip={() => void tipProfileToken()}
                onBuy={() => void buyProfileToken()}
                onSell={() => void sellProfileToken()}
                onLiquidity={() => void provideLiquidity()}
                onUpdateUri={() => void updateTokenURI()}
              />
            </>
          )}
        </section>
      ) : null}

      {!signingKey && (tab === 'assets' && tokens.length > 0) && (
        <p className="wallet-token-hint">Unlock is requested only when you approve a transaction.</p>
      )}
      {transactionHash && !profileToken && (
        <p className="wallet-transaction-status" role="status">
          Confirmed on Celo Sepolia: <a href={`${CELO_SEPOLIA.blockExplorer}/tx/${transactionHash}`} target="_blank" rel="noreferrer">{transactionHash.slice(0, 10)}…</a>
        </p>
      )}
      {error && <p className="you-error wallet-token-error" role="alert">{error}</p>}
    </section>
  );
}

function profileIconSrc(token: ProfileTokenDetails, statsIcon?: string) {
  const uri = token.tokenURI;
  if (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('data:') || uri.startsWith('/')) return uri;
  return statsIcon || null;
}

function shownAmount(value: bigint, decimals: number, digits = 4) {
  const amount = Number(formatUnits(value, decimals));
  if (!Number.isFinite(amount)) return formatUnits(value, decimals);
  return amount.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function ProfileTokenPage({
  token,
  iconSrc,
  chainLabel,
  explorerBase,
  copied,
  onCopy,
  action,
  onAction,
  poolReady,
  canSeed,
  recipient,
  onRecipient,
  tipAmount,
  onTipAmount,
  buyUsdtAmount,
  onBuyUsdtAmount,
  sellTokenAmount,
  onSellTokenAmount,
  liquidityTokenAmount,
  onLiquidityTokenAmount,
  liquidityUsdtAmount,
  onLiquidityUsdtAmount,
  onUseDefaults,
  initialPricePreview,
  signingKey,
  pinProtected,
  pin,
  onPin,
  operation,
  tipFee,
  buyFee,
  sellFee,
  editTokenURI,
  onEditTokenURI,
  transactionHash,
  onTip,
  onBuy,
  onSell,
  onLiquidity,
  onUpdateUri,
}: {
  token: ProfileTokenDetails;
  iconSrc: string | null;
  chainLabel: string;
  explorerBase: string;
  copied: boolean;
  onCopy: () => void;
  action: 'send' | 'trade' | 'liquidity';
  onAction: (action: 'send' | 'trade' | 'liquidity') => void;
  poolReady: boolean;
  canSeed: boolean;
  recipient: string;
  onRecipient: (value: string) => void;
  tipAmount: string;
  onTipAmount: (value: string) => void;
  buyUsdtAmount: string;
  onBuyUsdtAmount: (value: string) => void;
  sellTokenAmount: string;
  onSellTokenAmount: (value: string) => void;
  liquidityTokenAmount: string;
  onLiquidityTokenAmount: (value: string) => void;
  liquidityUsdtAmount: string;
  onLiquidityUsdtAmount: (value: string) => void;
  onUseDefaults: () => void;
  initialPricePreview: number;
  signingKey: boolean;
  pinProtected?: boolean;
  pin: string;
  onPin: (value: string) => void;
  operation: 'import' | 'launch' | 'tip' | 'buy' | 'sell' | 'update-uri' | 'liquidity' | null;
  tipFee: { quote: Parameters<typeof FeePreview>[0]['quote']; error: string; loading: boolean };
  buyFee: { quote: Parameters<typeof FeePreview>[0]['quote']; error: string; loading: boolean };
  sellFee: { quote: Parameters<typeof FeePreview>[0]['quote']; error: string; loading: boolean };
  editTokenURI: string;
  onEditTokenURI: (value: string) => void;
  transactionHash: string;
  onTip: () => void;
  onBuy: () => void;
  onSell: () => void;
  onLiquidity: () => void;
  onUpdateUri: () => void;
}) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 861px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const available = shownAmount(token.balance, token.decimals);
  const supply = shownAmount(token.totalSupply, token.decimals, 2);
  const treasury = shownAmount(token.treasuryBalance, token.decimals, 2);
  const explorer = `${explorerBase}/address/${token.address}`;
  let tipTooMuch = false;
  if (tipAmount) {
    try {
      tipTooMuch = parseUnits(tipAmount, token.decimals) > token.balance;
    } catch {
      tipTooMuch = true;
    }
  }
  const unlock = (id: string) => signingKey ? null : (
    <div className="wallet-token-unlock">
      <label className="wallet-field-label" htmlFor={id}>{pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
      <UnlockSecret id={id} pinProtected={pinProtected} value={pin} onChange={onPin} />
    </div>
  );
  const facts: Array<[string, string]> = [
    ['Symbol', token.symbol],
    ['Decimals', String(token.decimals)],
    ['Total supply', `${supply} ${token.symbol}`],
    ['Treasury reserve', `${treasury} ${token.symbol}`],
    ['Network', chainLabel],
  ];

  return (
    <div className="ptoken">
      <header className="ptoken-head">
        {iconSrc ? (
          // Token art comes from the token's own URI, which is not a fixed image host.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ptoken-icon" src={iconSrc} alt="" />
        ) : null}
        <div>
          <h3>{token.name}</h3>
          <p>{token.symbol}</p>
        </div>
      </header>
      <div className="ptoken-layout">
        <div className="ptoken-main">
          <section className="ptoken-card" aria-label="Token balance">
            <p>Available to you</p>
            <strong>{available} <small>{token.symbol}</small></strong>
            <dl className="ptoken-stats">
              <div><dt>Total supply</dt><dd>{supply} {token.symbol}</dd></div>
              <div><dt>Treasury reserve</dt><dd>{treasury} {token.symbol}</dd></div>
              <div>
                <dt>Price</dt>
                <dd>{token.price == null ? 'Price unavailable' : `${token.price.toPrecision(5)} USDT`}</dd>
              </div>
            </dl>
            {token.price != null && token.priceSource && <p className="ptoken-note">{token.priceSource} · indicative, not a sale quote</p>}
            <div className="ptoken-links">
              <Button type="button" variant="outline" onClick={onCopy}><Copy size={15} />{copied ? 'Copied' : 'Copy address'}</Button>
              <a className="wallet-token-explorer" href={explorer} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13} /></a>
            </div>
          </section>

          <div className="ptoken-tabs" role="tablist" aria-label="Token actions">
            <button type="button" role="tab" aria-selected={action === 'send'} className={action === 'send' ? 'is-active' : ''} onClick={() => onAction('send')}>Send</button>
            {poolReady && <button type="button" role="tab" aria-selected={action === 'trade'} className={action === 'trade' ? 'is-active' : ''} onClick={() => onAction('trade')}>Trade</button>}
            <button type="button" role="tab" aria-selected={action === 'liquidity'} className={action === 'liquidity' ? 'is-active' : ''} onClick={() => onAction('liquidity')}>Liquidity</button>
          </div>

          {action === 'send' && (
            <section className="ptoken-panel" aria-label="Send or tip">
              <h3>Send or tip</h3>
              <label className="wallet-field-label" htmlFor="profile-token-recipient">Recipient address</label>
              <input id="profile-token-recipient" className="you-passphrase" value={recipient} onChange={(event) => onRecipient(event.target.value)} placeholder="0x…" autoComplete="off" />
              <label className="wallet-field-label" htmlFor="profile-token-amount">Amount · available {available} {token.symbol}</label>
              <div className="wallet-send-amount-row">
                <input id="profile-token-amount" className="you-passphrase" value={tipAmount} onChange={(event) => onTipAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                <Button type="button" variant="outline" onClick={() => onTipAmount(formatUnits(token.balance, token.decimals))}>Max</Button>
              </div>
              {tipTooMuch && <p className="you-error" role="alert">Amount exceeds the available balance.</p>}
              {unlock('profile-token-send-pin')}
              <FeePreview quote={tipFee.quote} error={tipFee.error} loading={tipFee.loading} />
              <Button type="button" className="w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={operation === 'tip' || !recipient || !tipAmount || tipTooMuch || Boolean(tipFee.error)} onClick={onTip}>
                {operation === 'tip' ? 'Sending…' : <><ArrowUpRight size={16} /> Send {token.symbol}</>}
              </Button>
            </section>
          )}

          {action === 'trade' && poolReady && (
            <section className="ptoken-panel" aria-label="Buy or sell">
              <h3>Buy or sell on your pool</h3>
              <label className="wallet-field-label" htmlFor="profile-token-buy-usdt">Buy with USDT</label>
              <input id="profile-token-buy-usdt" className="you-passphrase" value={buyUsdtAmount} onChange={(event) => onBuyUsdtAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="USDT amount" inputMode="decimal" />
              {unlock('profile-token-buy-pin')}
              <FeePreview quote={buyFee.quote} error={buyFee.error} loading={buyFee.loading} />
              <Button type="button" className="w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={operation === 'buy' || operation === 'sell' || !buyUsdtAmount || Boolean(buyFee.error)} onClick={onBuy}>
                {operation === 'buy' ? 'Buying…' : `Buy ${token.symbol}`}
              </Button>
              <label className="wallet-field-label" htmlFor="profile-token-sell-amount">Sell {token.symbol}</label>
              <input id="profile-token-sell-amount" className="you-passphrase" value={sellTokenAmount} onChange={(event) => onSellTokenAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder={`${token.symbol} amount`} inputMode="decimal" />
              {unlock('profile-token-sell-pin')}
              <FeePreview quote={sellFee.quote} error={sellFee.error} loading={sellFee.loading} />
              <Button type="button" variant="outline" className="w-full" disabled={operation === 'buy' || operation === 'sell' || !sellTokenAmount || Boolean(sellFee.error)} onClick={onSell}>
                {operation === 'sell' ? 'Selling…' : `Sell ${token.symbol} for USDT`}
              </Button>
              <p className="wallet-token-footnote">No protocol trade tax. Trades use a 5% minimum-receive tolerance against the displayed spot price; large price moves or price impact can make a trade revert.</p>
            </section>
          )}

          {action === 'liquidity' && (
            poolReady || canSeed ? (
              <section className="ptoken-panel" aria-label="Liquidity">
                <h3>{poolReady ? 'Add to your Uniswap V4 pool' : 'Seed your Uniswap V4 pool'}</h3>
                <label className="wallet-field-label" htmlFor="profile-token-liquidity-token">{token.symbol} amount</label>
                <input id="profile-token-liquidity-token" className="you-passphrase" value={liquidityTokenAmount} onChange={(event) => onLiquidityTokenAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                <label className="wallet-field-label" htmlFor="profile-token-liquidity-usdt">USDT amount</label>
                <input id="profile-token-liquidity-usdt" className="you-passphrase" value={liquidityUsdtAmount} onChange={(event) => onLiquidityUsdtAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                {!poolReady && (
                  <Button type="button" variant="outline" className="whitespace-normal" onClick={onUseDefaults}>
                    Use defaults (1,000 {token.symbol} + 10 USDT · 0.01 USDT start)
                  </Button>
                )}
                {unlock('profile-token-liquidity-pin')}
                {!poolReady && Number.isFinite(initialPricePreview) && initialPricePreview > 0 && (
                  <p className="wallet-token-price-preview">Starting spot price · {initialPricePreview.toPrecision(5)} USDT per {token.symbol}</p>
                )}
                <Button type="button" className="w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={operation === 'liquidity' || !liquidityTokenAmount || !liquidityUsdtAmount} onClick={onLiquidity}>
                  {operation === 'liquidity' ? 'Approving and adding…' : poolReady ? 'Add liquidity' : 'Create pool and seed'}
                </Button>
                <p className="wallet-token-footnote">{poolReady
                  ? 'The pool keeps its current price. The factory may use less than the amounts entered and returns unused tokens.'
                  : 'The starting spot price is set from the token and USDT amounts above. The factory may use less than those amounts and returns unused tokens.'} You will approve only the amounts needed.</p>
              </section>
            ) : (
              <div className="wallet-liquidity-notice">
                <div><ArrowDownToLine size={16} /><strong>Uniswap liquidity</strong></div>
                <p>Initial liquidity seeding is paused for safety. The deployed factory initializes new pools at a hard-coded raw 1:1 price instead of the price you choose. The contract must be upgraded before adding USDT liquidity.</p>
              </div>
            )
          )}

          <details className="wallet-token-manage-details">
            <summary>Manage token details</summary>
            <label className="wallet-field-label" htmlFor="profile-token-uri-edit">Token details URL</label>
            <input id="profile-token-uri-edit" className="you-passphrase" value={editTokenURI} onChange={(event) => onEditTokenURI(event.target.value)} placeholder="https://… or ipfs://" maxLength={2048} />
            {unlock('profile-token-manage-pin')}
            <Button type="button" variant="outline" disabled={operation === 'update-uri'} onClick={onUpdateUri}>{operation === 'update-uri' ? 'Saving…' : 'Update token details'}</Button>
          </details>
          {transactionHash && (
            <p className="wallet-transaction-status" role="status">
              Confirmed: <a href={`${explorerBase}/tx/${transactionHash}`} target="_blank" rel="noreferrer">{transactionHash.slice(0, 10)}…</a>
            </p>
          )}
        </div>
        <details className="ptoken-details" open={wide || undefined}>
          <summary>Token details</summary>
          <dl>
            {facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
            <div><dt>Contract</dt><dd>{token.address.slice(0, 6)}…{token.address.slice(-4)}</dd></div>
          </dl>
          <div className="ptoken-links">
            <Button type="button" variant="outline" onClick={onCopy}><Copy size={15} />{copied ? 'Copied' : 'Copy address'}</Button>
            <a className="wallet-token-explorer" href={explorer} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13} /></a>
          </div>
        </details>
      </div>
    </div>
  );
}
