export interface DemoUser {
  id: string;
  walletAddress: string;
  username: string;
  avatarUrl: string;
  visibility: 'approximate';
  createdAt: number;
  updatedAt: number;
}

export const demoUser: DemoUser = {
  id: 'demo-user-1',
  walletAddress: '0x742d35Cc6634C0532925a3b8D4C0532925a3b8D4',
  username: 'genesis',
  avatarUrl: '',
  visibility: 'approximate',
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now(),
};

export interface DemoToken {
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
  claimLocation?: { lat: number; lng: number; timestamp: number };
  claimRadius?: number;
  claimStartTime?: number;
  claimEndTime?: number;
}

export const demoTokens: DemoToken[] = [
  {
    id: 'token-oliseh',
    name: 'Oliseh',
    symbol: 'OLISEH',
    description: 'Personal token of Genesis. Claim, tip, and build community.',
    iconUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=oliseh&backgroundColor=ffffff',
    maxSupply: BigInt(1000000),
    initialSupply: BigInt(100000),
    circulatingSupply: BigInt(382000),
    creatorAddress: '0x742d35Cc6634C0532925a3b8D4C0532925a3b8D4',
    contractAddress: '0x1234567890123456789012345678901234567890',
    chainId: 84532,
    createdAt: Date.now() - 604800000,
    claimAmount: BigInt(10),
    maxClaimants: 1000,
  },
  {
    id: 'token-dev26',
    name: 'DEVCON 2026',
    symbol: 'DEV26',
    description: 'Official event token for DEVCON 2026. Earn by attending, participating, and building.',
    iconUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=dev26&backgroundColor=ffffff',
    maxSupply: BigInt(100000),
    initialSupply: BigInt(10000),
    circulatingSupply: BigInt(45000),
    creatorAddress: '0xEventOrganizer123456789012345678901234567890',
    contractAddress: '0x0987654321098765432109876543210987654321',
    chainId: 84532,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'token-ethhouse',
    name: 'ETH House',
    symbol: 'ETHHOUSE',
    description: 'Community token for ETH House Nairobi. Access events, merch, and governance.',
    iconUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=ethhouse&backgroundColor=ffffff',
    maxSupply: BigInt(500000),
    initialSupply: BigInt(50000),
    circulatingSupply: BigInt(125000),
    creatorAddress: '0xETHHouseOrg12345678901234567890123456789012',
    contractAddress: '0x1122334455667788990011223344556677889900',
    chainId: 84532,
    createdAt: Date.now() - 172800000,
    claimAmount: BigInt(50),
    maxClaimants: 500,
  },
];

export interface DemoDrop {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  tokenIconUrl: string;
  totalAmount: bigint;
  amountPerClaim: bigint;
  maxClaimants: number;
  currentClaimants: number;
  location: { lat: number; lng: number; timestamp: number };
  radius: number;
  startTime: number;
  endTime: number;
  status: 'upcoming' | 'active' | 'ended' | 'claimed-out';
  claimedBy: string[];
  qrCode?: string;
  qrExpiresAt?: number;
  createdAt: number;
}

export const demoDrops: DemoDrop[] = [
  {
    id: 'drop-oliseh-kicc',
    tokenId: 'token-oliseh',
    tokenSymbol: 'OLISEH',
    tokenIconUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=oliseh&backgroundColor=ffffff',
    totalAmount: BigInt(10000),
    amountPerClaim: BigInt(100),
    maxClaimants: 100,
    currentClaimants: 23,
    location: { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
    radius: 100,
    startTime: Date.now() - 3600000,
    endTime: Date.now() + 7200000,
    status: 'active',
    claimedBy: [],
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'drop-dev26-checkin',
    tokenId: 'token-dev26',
    tokenSymbol: 'DEV26',
    tokenIconUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=dev26&backgroundColor=ffffff',
    totalAmount: BigInt(5000),
    amountPerClaim: BigInt(50),
    maxClaimants: 100,
    currentClaimants: 67,
    location: { lat: -1.2915, lng: 36.8225, timestamp: Date.now() },
    radius: 50,
    startTime: Date.now() - 7200000,
    endTime: Date.now() + 10800000,
    status: 'active',
    claimedBy: [],
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'drop-ethhouse-booth',
    tokenId: 'token-ethhouse',
    tokenSymbol: 'ETHHOUSE',
    tokenIconUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=ethhouse&backgroundColor=ffffff',
    totalAmount: BigInt(2000),
    amountPerClaim: BigInt(20),
    maxClaimants: 100,
    currentClaimants: 12,
    location: { lat: -1.293, lng: 36.821, timestamp: Date.now() },
    radius: 30,
    startTime: Date.now() - 1800000,
    endTime: Date.now() + 1800000,
    status: 'active',
    claimedBy: [],
    createdAt: Date.now() - 1800000,
  },
];

export interface DemoEvent {
  id: string;
  name: string;
  description: string;
  location: { lat: number; lng: number; timestamp: number };
  radius: number;
  startTime: number;
  endTime: number;
  tokenId?: string;
  drops: string[];
  quests: string[];
  sponsors: DemoSponsor[];
  isActive: boolean;
}

export interface DemoSponsor {
  id: string;
  name: string;
  logoUrl: string;
  tokenId?: string;
  boothLocation?: { lat: number; lng: number; timestamp: number };
  description: string;
}

export const demoEvents: DemoEvent[] = [
  {
    id: 'event-devcon-nairobi',
    name: 'DEVCON Nairobi 2026',
    description: 'The biggest Ethereum developer conference in Africa. Build, learn, and connect with developers from across the continent.',
    location: { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
    radius: 500,
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 172800000,
    tokenId: 'token-dev26',
    drops: ['drop-dev26-checkin'],
    quests: ['quest-devcon-explorer'],
    sponsors: [
      {
        id: 'sponsor-ethhouse',
        name: 'ETH House',
        logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=ethhouse&backgroundColor=ffffff',
        tokenId: 'token-ethhouse',
        boothLocation: { lat: -1.293, lng: 36.821, timestamp: Date.now() },
        description: 'Community hub for Ethereum builders in Nairobi',
      },
      {
        id: 'sponsor-base',
        name: 'Base',
        logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=base&backgroundColor=ffffff',
        description: 'L2 for builders. Low fees, fast transactions.',
      },
    ],
    isActive: true,
  },
];

export interface DemoPlace {
  id: string;
  name: string;
  description: string;
  location: { lat: number; lng: number; timestamp: number };
  category: 'venue' | 'food' | 'shop' | 'activity' | 'landmark' | 'community';
  iconUrl: string;
  tokenId?: string;
  drops: string[];
}

export const demoPlaces: DemoPlace[] = [
  {
    id: 'place-kicc',
    name: 'KICC',
    description: 'Kenyatta International Convention Centre - Main venue for DEVCON Nairobi',
    location: { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
    category: 'venue',
    iconUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=kicc&backgroundColor=ffffff',
    tokenId: 'token-dev26',
    drops: ['drop-oliseh-kicc'],
  },
  {
    id: 'place-java-house',
    name: 'Java House KICC',
    description: 'Coffee and food near the venue',
    location: { lat: -1.2918, lng: 36.8222, timestamp: Date.now() },
    category: 'food',
    iconUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=javahouse&backgroundColor=ffffff',
    drops: [],
  },
  {
    id: 'place-ethhouse',
    name: 'ETH House Nairobi',
    description: 'Community space for Ethereum builders',
    location: { lat: -1.293, lng: 36.821, timestamp: Date.now() },
    category: 'community',
    iconUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=ethhouse&backgroundColor=ffffff',
    tokenId: 'token-ethhouse',
    drops: ['drop-ethhouse-booth'],
  },
];

export interface DemoQuest {
  id: string;
  eventId: string;
  title: string;
  description: string;
  tasks: Array<{
    id: string;
    type: 'visit' | 'meet' | 'claim' | 'attend' | 'custom';
    targetId: string;
    targetName: string;
    completed: boolean;
  }>;
  rewardTokenId: string;
  rewardAmount: bigint;
  completedBy: string[];
}

export const demoQuests: DemoQuest[] = [
  {
    id: 'quest-devcon-explorer',
    eventId: 'event-devcon-nairobi',
    title: 'DEVCON Explorer',
    description: 'Explore the conference and earn DEV26 tokens',
    tasks: [
      { id: 'task-1', type: 'visit', targetId: 'place-kicc', targetName: 'Visit KICC Main Hall', completed: false },
      { id: 'task-2', type: 'claim', targetId: 'drop-dev26-checkin', targetName: 'Claim DEV26 Check-in Drop', completed: false },
      { id: 'task-3', type: 'meet', targetId: 'user-1', targetName: 'Meet 3 developers', completed: false },
      { id: 'task-4', type: 'attend', targetId: 'event-devcon-nairobi', targetName: 'Attend a workshop', completed: false },
    ],
    rewardTokenId: 'token-dev26',
    rewardAmount: BigInt(100),
    completedBy: [],
  },
];

export interface DemoPerson {
  id: string;
  username: string;
  avatarUrl: string;
  tokenSymbol?: string;
  position: { lat: number; lng: number; timestamp?: number };
  distance: number;
  status: 'online' | 'away' | 'busy';
  lastActive: number;
  walletAddress?: string;
  visibility?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const demoPeople: DemoPerson[] = [
  {
    id: 'user-1',
    username: 'alice',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=alice&backgroundColor=ffffff',
    tokenSymbol: 'ALICE',
    position: { lat: -1.2923, lng: 36.8221 },
    distance: 25,
    status: 'online',
    lastActive: Date.now(),
  },
  {
    id: 'user-2',
    username: 'bob',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=bob&backgroundColor=ffffff',
    tokenSymbol: 'BOB',
    position: { lat: -1.2919, lng: 36.8225 },
    distance: 45,
    status: 'online',
    lastActive: Date.now() - 300000,
  },
  {
    id: 'user-3',
    username: 'carol',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=carol&backgroundColor=ffffff',
    position: { lat: -1.2925, lng: 36.8215 },
    distance: 60,
    status: 'away',
    lastActive: Date.now() - 600000,
  },
  {
    id: 'user-4',
    username: 'david',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=david&backgroundColor=ffffff',
    tokenSymbol: 'DAVID',
    position: { lat: -1.2917, lng: 36.8218 },
    distance: 80,
    status: 'online',
    lastActive: Date.now() - 120000,
  },
  {
    id: 'user-5',
    username: 'eve',
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=eve&backgroundColor=ffffff',
    position: { lat: -1.2928, lng: 36.822 },
    distance: 120,
    status: 'busy',
    lastActive: Date.now() - 900000,
  },
];

import type { MapMarker, Position } from '@/types';

function createPersonMarker(person: DemoPerson): MapMarker {
  return {
    id: `person-${person.id}`,
    type: 'person',
    position: { ...person.position, timestamp: person.position.timestamp || Date.now() },
    data: {
      userId: person.id,
      username: person.username,
      avatarUrl: person.avatarUrl,
      tokenSymbol: person.tokenSymbol,
      distance: person.distance,
    },
  };
}

function createDropMarker(drop: DemoDrop): MapMarker {
  return {
    id: `drop-${drop.id}`,
    type: 'drop',
    position: drop.location,
    data: {
      dropId: drop.id,
      tokenSymbol: drop.tokenSymbol,
      tokenIconUrl: drop.tokenIconUrl,
      amountPerClaim: drop.amountPerClaim,
      claimsRemaining: drop.maxClaimants - drop.currentClaimants,
      distance: 0,
      isEligible: true,
    },
  };
}

function createEventMarker(event: DemoEvent): MapMarker {
  return {
    id: `event-${event.id}`,
    type: 'event',
    position: event.location,
    data: {
      eventId: event.id,
      name: event.name,
      startTime: event.startTime,
      tokenSymbol: event.tokenId ? demoTokens.find(t => t.id === event.tokenId)?.symbol : undefined,
      distance: 0,
      isActive: event.isActive,
    },
  };
}

function createPlaceMarker(place: DemoPlace): MapMarker {
  return {
    id: `place-${place.id}`,
    type: 'place',
    position: place.location,
    data: {
      placeId: place.id,
      name: place.name,
      category: place.category,
      iconUrl: place.iconUrl,
      distance: 0,
      hasActiveDrops: place.drops.length > 0,
    },
  };
}

function createQuestMarker(quest: DemoQuest): MapMarker {
  const completedTasksCount = quest.tasks.filter(t => t.completed).length || 0;
  return {
    id: `quest-${quest.id}`,
    type: 'quest',
    position: demoEvents.find(e => e.id === quest.eventId)?.location || { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
    data: {
      questId: quest.id,
      title: quest.title,
      progress: completedTasksCount || 0,
      totalTasks: quest.tasks.length || 0,
      distance: 0,
    },
  };
}

export const demoMarkers: MapMarker[] = [
  ...demoPeople.map(createPersonMarker),
  ...demoDrops.map(createDropMarker),
  ...demoEvents.map(createEventMarker),
  ...demoPlaces.map(createPlaceMarker),
  ...demoQuests.map(createQuestMarker),
];

export function getDemoData() {
  return {
    user: demoUser,
    tokens: demoTokens,
    drops: demoDrops,
    events: demoEvents,
    places: demoPlaces,
    quests: demoQuests,
    people: demoPeople,
    markers: demoMarkers,
  };
}