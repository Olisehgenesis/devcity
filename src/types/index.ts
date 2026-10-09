export interface User {
  id: string;
  walletAddress: string;
  username: string;
  avatarUrl: string;
  visibility: VisibilityMode;
  createdAt: number;
  updatedAt: number;
}

export type VisibilityMode = 'invisible' | 'approximate' | 'event-only' | 'friends-only' | 'visible';

export interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface ApproximatePosition {
  geohash: string;
  cellCenter: Position;
  jitter: Position;
}

export interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  iconUrl: string;
  maxSupply: bigint;
  initialSupply: bigint;
  circulatingSupply: bigint;
  creatorAddress: string;
  contractAddress: string;
  chainId: number;
  createdAt: number;
  claimAmount?: bigint;
  maxClaimants?: number;
  claimLocation?: Position;
  claimRadius?: number;
  claimStartTime?: number;
  claimEndTime?: number;
}

export interface Drop {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  tokenIconUrl: string;
  totalAmount: bigint;
  amountPerClaim: bigint;
  maxClaimants: number;
  currentClaimants: number;
  location: Position;
  radius: number;
  startTime: number;
  endTime: number;
  status: DropStatus;
  claimedBy: string[];
  qrCode?: string;
  qrExpiresAt?: number;
  createdAt: number;
}

export type DropStatus = 'upcoming' | 'active' | 'ended' | 'claimed-out';

export interface ClaimEligibility {
  eligible: boolean;
  reason?: string;
  drop: Drop;
  userClaimed: boolean;
  claimsRemaining: number;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  location: Position;
  radius: number;
  startTime: number;
  endTime: number;
  tokenId?: string;
  drops: string[];
  quests: string[];
  sponsors: Sponsor[];
  isActive: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  tokenId?: string;
  boothLocation?: Position;
  description: string;
}

export interface Place {
  id: string;
  name: string;
  description: string;
  location: Position;
  category: PlaceCategory;
  iconUrl: string;
  tokenId?: string;
  drops: string[];
}

export type PlaceCategory = 'venue' | 'food' | 'shop' | 'activity' | 'landmark' | 'community';

export interface Quest {
  id: string;
  eventId: string;
  title: string;
  description: string;
  tasks: QuestTask[];
  rewardTokenId: string;
  rewardAmount: bigint;
  completedBy: string[];
}

export interface QuestTask {
  id: string;
  type: 'visit' | 'meet' | 'claim' | 'attend' | 'custom';
  targetId: string;
  targetName: string;
  completed: boolean;
}

export interface Tip {
  id: string;
  fromUserId: string;
  toUserId: string;
  tokenId: string;
  amount: bigint;
  message?: string;
  createdAt: number;
  txHash: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'claim' | 'tip' | 'create-token' | 'create-drop' | 'add-liquidity' | 'swap';
  tokenId: string;
  amount: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  createdAt: number;
}

export interface MapMarker {
  id: string;
  type: 'person' | 'drop' | 'event' | 'place' | 'quest' | 'market';
  position: Position;
  data: PersonMarkerData | DropMarkerData | EventMarkerData | PlaceMarkerData | QuestMarkerData;
}

export interface PersonMarkerData {
  userId: string;
  username: string;
  avatarUrl: string;
  tokenSymbol?: string;
  distance: number;
}

export interface DropMarkerData {
  dropId: string;
  tokenSymbol: string;
  tokenIconUrl: string;
  amountPerClaim: bigint;
  claimsRemaining: number;
  distance: number;
  isEligible: boolean;
}

export interface EventMarkerData {
  eventId: string;
  name: string;
  startTime: number;
  tokenSymbol?: string;
  distance: number;
  isActive: boolean;
}

export interface PlaceMarkerData {
  placeId: string;
  name: string;
  category: PlaceCategory;
  iconUrl: string;
  distance: number;
  hasActiveDrops: boolean;
}

export interface QuestMarkerData {
  questId: string;
  title: string;
  progress: number;
  totalTasks: number;
  distance: number;
}

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    tokenFactory: string;
    dropManager: string;
  };
}

export const BASE_SEPOLIA: ChainConfig = {
  id: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorerUrl: 'https://sepolia.basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    tokenFactory: '',
    dropManager: '',
  },
};

export const BASE_MAINNET: ChainConfig = {
  id: 8453,
  name: 'Base',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorerUrl: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    tokenFactory: '',
    dropManager: '',
  },
};

export const SUPPORTED_CHAINS = [BASE_SEPOLIA, BASE_MAINNET] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];

export interface WalletState {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  isConnecting: boolean;
  isSmartAccount: boolean;
  passkeyRegistered: boolean;
}

export interface ClaimRequest {
  dropId: string;
  userAddress: string;
  signature: string;
  nonce: number;
}

export interface SignedClaimAuthorization {
  dropId: string;
  claimant: string;
  amount: bigint;
  nonce: number;
  deadline: number;
  signature: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface GeohashCell {
  geohash: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: Position;
}