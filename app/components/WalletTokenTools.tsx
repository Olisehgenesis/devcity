'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, CirclePlus, Copy, ExternalLink, RefreshCw, X } from 'lucide-react';
import {
  createPublicClient,
  createWalletClient,
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
}

export function WalletTokenTools({ wallet, username, assetChainId, assetChainLabel, unlockedKey, onUnlockKey, onTokensChange, notify, focus, onSelectImported }: WalletTokenToolsProps) {
  const [tab, setTab] = useState<'assets' | 'profile-token'>('assets');
  const [tokens, setTokens] = useState<ImportedWalletToken[]>([]);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [profileToken, setProfileToken] = useState<ProfileTokenDetails | null>(null);
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

  const normalizedUsername = useMemo(
    () => username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'CITY',
    [username],
  );
  const initialPricePreview = Number(liquidityUsdtAmount) / Number(liquidityTokenAmount);

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
      if (address.toLowerCase() === zeroAddress) {
        setProfileToken(null);
        return;
      }

      const [name, symbol, decimals, totalSupply, balance, treasuryBalance, uri, poolCreated] = await Promise.all([
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [wallet.address as Address] }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [CELO_SEPOLIA.profileTokenFactory as Address] }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'tokenURI' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'poolCreated' }),
      ]);
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
    } catch (readError) {
      setError(readError instanceof Error ? `Could not load your profile token: ${readError.message}` : 'Could not load your profile token.');
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

  const ensureUnlocked = async (): Promise<Hex> => {
    if (unlockedKey) return unlockedKey;
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
      const hash = await client.writeContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'createToken',
        args: [name, symbol, uri],
      });
      await waitForSuccess(hash);
      await loadProfileToken();
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
      const hash = await client.writeContract({
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
        const approval = await client.writeContract({
          address: SEPOLIA_USDT,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [profileToken.address, amountIn],
        });
        await waitForSuccess(approval);
      }
      const hash = await client.writeContract({
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
      const hash = await client.writeContract({
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
      const hash = await client.writeContract({
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
        const tokenApproval = await client.writeContract({
          address: profileToken.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [factory, tokenAmount],
        });
        await waitForSuccess(tokenApproval);
      }
      if (usdtAllowance < usdtAmount) {
        const usdtApproval = await client.writeContract({
          address: SEPOLIA_USDT,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [factory, usdtAmount],
        });
        await waitForSuccess(usdtApproval);
      }
      const hash = isInitialPool
        ? await client.writeContract({
          address: factory,
          abi: PROFILE_FACTORY_ABI,
          functionName: 'createPoolAndAddLiquidityAtPrice',
          args: [amount0, amount1, BigInt(0), BigInt(0), initialSqrtPriceX96, deadline],
        })
        : await client.writeContract({
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
          <div className="wallet-section-heading wallet-assets-heading">
            <div><h3>{focus === 'assets' ? 'Imported' : 'Other tokens'}</h3><span>On {assetChainLabel} · stored on this device</span></div>
            <button className="wallet-token-add" onClick={() => { setImportOpen(true); setError(''); }}><CirclePlus size={16} /> Import</button>
          </div>
          {tokens.length === 0 ? (
            <div className="wallet-token-empty">
              <strong>Keep your tokens together.</strong>
              <p>Import an ERC-20 contract address to see its on-chain balance and market data where Celo markets are indexed.</p>
            </div>
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
                    <button
                      className="wallet-token-remove"
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
                    ><X size={15} /></button>
                    {price?.source && <small className="wallet-token-source">{price.source}{price.liquidityUsd ? ` · $${Math.round(price.liquidityUsd).toLocaleString()} pool liquidity` : ''}</small>}
                  </article>
                );
              })}
            </div>
          )}
          {importOpen && (
            <div className="wallet-action-panel wallet-token-import-panel">
              <div className="wallet-section-heading"><h3>Import an ERC-20</h3><button onClick={() => setImportOpen(false)} aria-label="Close token import">Close</button></div>
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
              <button className="you-connect-primary" disabled={operation === 'import' || !importAddress} onClick={() => void importToken()}>
                {operation === 'import' ? 'Checking contract…' : 'Add token'}
              </button>
            </div>
          )}
          <button className="wallet-token-refresh" onClick={() => void loadTokens()}><RefreshCw size={14} /> Refresh balances and prices</button>
        </section>
      ) : showProfile ? (
        <section className="wallet-profile-token">
          {!profileToken ? (
            focus === 'trade' ? (
              <p className="you-note">No profile token yet. Open Profile token on the wallet home to launch one.</p>
            ) : (
            <>
              <div className="wallet-token-empty wallet-profile-token-empty">
                <span className="wallet-token-orbit">✳</span>
                <strong>Your profile can have its own token.</strong>
                <p>Launch a fixed-supply token tied to this wallet. Your tokens are created on Celo Sepolia and are not real-world money.</p>
              </div>
              <div className="wallet-launch-preview">
                <span className="wallet-token-mark">{tokenSymbol.slice(0, 1) || 'T'}</span>
                <div><strong>{tokenName || `${username || 'Your name'}.devcity.fun`}</strong><span>${tokenSymbol || normalizedUsername || 'TICKER'} · 1,000,000 supply</span></div>
              </div>
              <div className="wallet-token-contract-note"><strong>Fixed launch terms</strong><span>1,000,000 tokens · 18 decimals · 900,000 to you · 100,000 held in the factory treasury · one token per wallet</span></div>
              {!unlockedKey && (
                <div className="wallet-token-unlock">
                  <label className="wallet-field-label" htmlFor="profile-token-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                  <input id="profile-token-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                </div>
              )}
              <button className="you-connect-primary" disabled={operation === 'launch'} onClick={() => void launchToken()}>
                {operation === 'launch' ? 'Launching on Sepolia…' : `Launch ${tokenSymbol || normalizedUsername || 'your'} token`}
              </button>
              <p className="wallet-token-footnote">Launching requires a Celo Sepolia transaction and network fees. Your token is named from your handle and saved to your profile.</p>
            </>
            )
          ) : (
            <>
              {focus !== 'trade' && (
              <div className="wallet-profile-token-card">
                <div className="wallet-profile-token-head">
                {profileStats?.icon
                  ? <img className="wallet-profile-token-icon" src={profileStats.icon} alt={`${profileToken.symbol} token icon`} />
                  : <span className="wallet-token-mark">{profileToken.symbol.slice(0, 1)}</span>}
                <div><strong>{profileToken.name}</strong><span>${profileToken.symbol} · Celo Sepolia</span></div>
              </div>
                <div className="wallet-profile-token-balance">
                  <strong>{Number(formatUnits(profileToken.balance, profileToken.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                  <span>available to you · {Number(formatUnits(profileToken.totalSupply, profileToken.decimals)).toLocaleString()} total supply</span>
                </div>
                <div className="wallet-profile-token-meta">
                  <span>Factory treasury reserve</span>
                  <strong>{Number(formatUnits(profileToken.treasuryBalance, profileToken.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {profileToken.symbol}</strong>
                </div>
                <div className="wallet-profile-token-meta">
                <span>Price</span><strong>{profileToken.price == null ? 'Price unavailable' : `${profileToken.price.toPrecision(5)} USDT`}</strong>
                  {profileToken.priceSource && <small>{profileToken.priceSource} · indicative, not a sale quote</small>}
                </div>
                <button className="wallet-profile-token-address" onClick={() => void copyAddress(profileToken.address)}><span>{profileToken.address}</span><Copy size={15} />{copied ? 'Copied' : 'Copy'}</button>
                <a className="wallet-token-explorer" href={`${window.location.origin}/api/token-icon?owner=${wallet.address}&chainId=${assetChainId}`} target="_blank" rel="noreferrer">Token profile image <ExternalLink size={13} /></a>
                <a className="wallet-token-explorer" href={`${CELO_SEPOLIA.blockExplorer}/address/${profileToken.address}`} target="_blank" rel="noreferrer">View token on Blockscout <ExternalLink size={13} /></a>
              </div>
              )}

              {profileToken.poolCreated && (
                <div className="wallet-profile-token-actions wallet-profile-token-trade">
                  <h3>Buy or sell on your pool</h3>
                  <label className="wallet-field-label" htmlFor="profile-token-buy-usdt">Buy with USDT</label>
                  <input id="profile-token-buy-usdt" className="you-passphrase" value={buyUsdtAmount} onChange={(event) => setBuyUsdtAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="USDT amount" inputMode="decimal" />
                  {!unlockedKey && (
                    <div className="wallet-token-unlock">
                      <label className="wallet-field-label" htmlFor="profile-token-buy-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                      <input id="profile-token-buy-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                    </div>
                  )}
                  <button className="you-connect-primary" disabled={operation === 'buy' || operation === 'sell' || !buyUsdtAmount} onClick={() => void buyProfileToken()}>
                    {operation === 'buy' ? 'Buying…' : `Buy ${profileToken.symbol}`}
                  </button>
                  <label className="wallet-field-label" htmlFor="profile-token-sell-amount">Sell {profileToken.symbol}</label>
                  <input id="profile-token-sell-amount" className="you-passphrase" value={sellTokenAmount} onChange={(event) => setSellTokenAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder={`${profileToken.symbol} amount`} inputMode="decimal" />
                  {!unlockedKey && (
                    <div className="wallet-token-unlock">
                      <label className="wallet-field-label" htmlFor="profile-token-sell-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                      <input id="profile-token-sell-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                    </div>
                  )}
                  <button className="you-connect-secondary" disabled={operation === 'buy' || operation === 'sell' || !sellTokenAmount} onClick={() => void sellProfileToken()}>
                    {operation === 'sell' ? 'Selling…' : `Sell ${profileToken.symbol} for USDT`}
                  </button>
                  <p className="wallet-token-footnote">No protocol trade tax. Trades use a 5% minimum-receive tolerance against the displayed spot price; large price moves or price impact can make a trade revert.</p>
                </div>
              )}
              {focus === 'trade' && !profileToken.poolCreated && (
                <p className="you-note">This profile token has no pool yet. Seed one from the token screen. DEV26 swap, below, signs with a browser wallet.</p>
              )}

              {focus !== 'trade' && (
              <>
              <div className="wallet-profile-token-actions">
                <h3>Send or tip your token</h3>
                <label className="wallet-field-label" htmlFor="profile-token-recipient">Recipient address</label>
                <input id="profile-token-recipient" className="you-passphrase" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" autoComplete="off" />
                <label className="wallet-field-label" htmlFor="profile-token-amount">Amount · available {Number(formatUnits(profileToken.balance, profileToken.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</label>
                <input id="profile-token-amount" className="you-passphrase" value={tipAmount} onChange={(event) => setTipAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                {!unlockedKey && (
                  <div className="wallet-token-unlock">
                    <label className="wallet-field-label" htmlFor="profile-token-send-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                    <input id="profile-token-send-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                  </div>
                )}
                <button className="you-connect-primary" disabled={operation === 'tip' || !recipient || !tipAmount} onClick={() => void tipProfileToken()}>
                  {operation === 'tip' ? 'Sending…' : <><ArrowUpRight size={16} /> Send {profileToken.symbol}</>}
                </button>
              </div>

              <details className="wallet-token-manage-details">
                <summary>Manage token details</summary>
                <label className="wallet-field-label" htmlFor="profile-token-uri-edit">Token details URL</label>
                <input id="profile-token-uri-edit" className="you-passphrase" value={editTokenURI} onChange={(event) => setEditTokenURI(event.target.value)} placeholder="https://… or ipfs://…" maxLength={2048} />
                {!unlockedKey && (
                  <div className="wallet-token-unlock">
                    <label className="wallet-field-label" htmlFor="profile-token-manage-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                    <input id="profile-token-manage-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                  </div>
                )}
                <button className="you-connect-secondary" disabled={operation === 'update-uri'} onClick={() => void updateTokenURI()}>{operation === 'update-uri' ? 'Saving…' : 'Update token details'}</button>
              </details>

              {profileToken.poolCreated || priceAwareFactory ? (
                <div className="wallet-profile-token-actions wallet-liquidity-form">
                  <h3>{profileToken.poolCreated ? 'Add to your Uniswap V4 pool' : 'Seed your Uniswap V4 pool'}</h3>
                  <label className="wallet-field-label" htmlFor="profile-token-liquidity-token">{profileToken.symbol} amount</label>
                  <input id="profile-token-liquidity-token" className="you-passphrase" value={liquidityTokenAmount} onChange={(event) => setLiquidityTokenAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                  <label className="wallet-field-label" htmlFor="profile-token-liquidity-usdt">USDT amount</label>
                  <input id="profile-token-liquidity-usdt" className="you-passphrase" value={liquidityUsdtAmount} onChange={(event) => setLiquidityUsdtAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
                  {!profileToken.poolCreated && (
                    <button type="button" className="wallet-token-quickseed" onClick={() => { setLiquidityTokenAmount('1000'); setLiquidityUsdtAmount('10'); setError(''); }}>
                      ⚡ Use defaults (1,000 {profileToken.symbol} + 10 USDT · 0.01 USDT start)
                    </button>
                  )}
                  {!unlockedKey && (
                    <div className="wallet-token-unlock">
                      <label className="wallet-field-label" htmlFor="profile-token-liquidity-pin">{wallet.pinProtected ? 'Wallet PIN' : 'Wallet passphrase'}</label>
                      <input id="profile-token-liquidity-pin" type="password" className="you-passphrase" value={pin} onChange={(event) => setPin(wallet.pinProtected ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} placeholder={wallet.pinProtected ? '6-digit PIN' : 'Wallet passphrase'} inputMode={wallet.pinProtected ? 'numeric' : undefined} maxLength={wallet.pinProtected ? 6 : undefined} autoComplete="current-password" />
                    </div>
                  )}
                  {!profileToken.poolCreated && Number.isFinite(initialPricePreview) && initialPricePreview > 0 && (
                    <p className="wallet-token-price-preview">Starting spot price · {initialPricePreview.toPrecision(5)} USDT per {profileToken.symbol}</p>
                  )}
                  <button className="you-connect-primary" disabled={operation === 'liquidity' || !liquidityTokenAmount || !liquidityUsdtAmount} onClick={() => void provideLiquidity()}>
                    {operation === 'liquidity' ? 'Approving and adding…' : profileToken.poolCreated ? 'Add liquidity' : 'Create pool and seed'}
                  </button>
                  <p className="wallet-token-footnote">{profileToken.poolCreated
                    ? 'The pool keeps its current price. The factory may use less than the amounts entered and returns unused tokens.'
                    : 'The starting spot price is set from the token and USDT amounts above. The factory may use less than those amounts and returns unused tokens.'} You will approve only the amounts needed.</p>
                </div>
              ) : (
                <div className="wallet-liquidity-notice">
                  <div><ArrowDownToLine size={16} /><strong>Uniswap liquidity</strong></div>
                  <p>Initial liquidity seeding is paused for safety. The deployed factory initializes new pools at a hard-coded raw 1:1 price instead of the price you choose. The contract must be upgraded before adding USDT liquidity.</p>
                </div>
              )}
              </>
              )}
            </>
          )}
        </section>
      ) : null}

      {!unlockedKey && (tab === 'assets' && tokens.length > 0) && (
        <p className="wallet-token-hint">Unlock is requested only when you approve a transaction.</p>
      )}
      {transactionHash && (
        <p className="wallet-transaction-status" role="status">
          Confirmed on Celo Sepolia: <a href={`${CELO_SEPOLIA.blockExplorer}/tx/${transactionHash}`} target="_blank" rel="noreferrer">{transactionHash.slice(0, 10)}…</a>
        </p>
      )}
      {error && <p className="you-error wallet-token-error" role="alert">{error}</p>}
    </section>
  );
}
