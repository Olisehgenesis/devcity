"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Gift,
  Heart,
  LocateFixed,
  MapPin,
  MapPinOff,
  MessageCircle,
  Plus,
  Trophy,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import { cityPinSvg } from "@/lib/city-markers";
import { eventPhase } from "@/lib/event-phase";
import { EventCard } from "./components/EventCard";
import { DevLocationGate } from "./components/DevLocationGate";
import { PushButton } from "./components/PushButton";
import { PinBoxes } from "./components/PinBoxes";
import type { DevLocationApply } from "./components/DevLocationPanel";
import { YouSheet } from "./components/YouSheet";
import { WalletSheet } from "./components/WalletSheet";
import { TipSheet, type TipTarget } from "./components/TipSheet";
import { Sheet } from "./components/Sheet";
import { CitySocialSheet, type FeedProfileStatus, type SocialView } from "./components/CitySocialSheet";
import { ScanSheet } from "./components/ScanSheet";
import { SearchSheet } from "./components/SearchSheet";
import { CreateDropSheet } from "./components/CreateDropSheet";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { useCityStore } from "./lib/city-store";
import { dicebearAvatarUrl } from "./lib/avatars";
import { GameIcon, NavIcon } from "./components/game/GameIcons";
import { BuildingSprite } from "./components/game/Buildings";
import { useGameStore } from "./lib/game-store";
import { encodeFunctionData, type Address } from "viem";
import { CELO_SEPOLIA } from "@/lib/chain";
import { writeContractWithFee } from "@/lib/gas";
import { useFeeQuote } from "./hooks/useFeeQuote";
import { FeePreview } from "./components/wallet/FeePreview";
import { CLAIM_RADIUS_M, distanceMeters } from "@/lib/geo";
import { claimDistanceSentence, claimFailureMessage, claimNeedsPin, resolveClaimView, type ClaimLocationStatus } from "@/lib/claim-eligibility";
import { TrendingSheet } from "./components/TrendingSheet";
import { LeaderboardSheet } from "./components/LeaderboardSheet";
import { NotificationSheet } from "./components/NotificationSheet";
import { SuggestedUsersSheet } from "./components/SuggestedUsersSheet";
import { StoryViewer } from "./components/StoryViewer";
import type { Story } from "./lib/stories";

type MarkerKind = "drop" | "person" | "place" | "event";
type CityMarker = {
  id: string;
  kind: MarkerKind;
  name: string;
  detail: string;
  distance: string;
  latitude: number;
  longitude: number;
  color: string;
  initials?: string;
  amount?: string;
  tokenSymbol?: string;
  claimedCount?: number;
  avatar?: string;
  url?: string;
  category?: string;
  raw?: EventApiItem;
};
type FilterKind = "all" | MarkerKind;
type NavTab = "map" | "feed" | "chat" | "wallet";

type EventApiItem = {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  summary: string | null;
  category: string | null;
  kind: string | null;
  region: string | null;
  location: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  url: string | null;
  timetable?: Array<{
    id: string;
    date: string;
    dayNumber: number | null;
    label: string | null;
    startTime: string | null;
    endTime: string | null;
    allDay: boolean;
    title: string | null;
  }>;
};

function eventWhen(event: EventApiItem) {
  return eventPhase({
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
  });
}

function eventToMarker(event: EventApiItem): CityMarker | null {
  if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return null;
  const start = new Date(event.startDate);
  const dateLabel = Number.isNaN(start.getTime())
    ? ""
    : start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const summary = event.summary?.trim() ?? "";
  const detail = summary
    ? summary.length > 110 ? `${summary.slice(0, 109)}…` : summary
    : [dateLabel, event.startTime].filter(Boolean).join(" · ") || "Event";
  return {
    id: `event-${event.slug}`,
    kind: "event",
    name: event.name,
    detail,
    distance: event.location?.trim() || "On the map",
    latitude: event.latitude,
    longitude: event.longitude,
    color: "blue",
    url: event.url ?? undefined,
    category: event.category ?? undefined,
    raw: event,
  };
}

type DropApiItem = {
  id: string;
  name: string;
  description: string | null;
  tokenSymbol: string | null;
  amount: string;
  maxClaimants: number;
  currentClaimants: number;
  lat: number | null;
  lng: number | null;
};

function dropToMarker(drop: DropApiItem): CityMarker | null {
  if (typeof drop.lat !== "number" || typeof drop.lng !== "number") return null;
  const token = drop.tokenSymbol ?? "TOKENS";
  return {
    id: `drop-${drop.id}`,
    kind: "drop",
    name: drop.name,
    detail: drop.description?.trim() || `${drop.amount} ${token}`,
    distance: "On the map",
    latitude: drop.lat,
    longitude: drop.lng,
    color: "lime",
    amount: drop.amount,
    tokenSymbol: token,
    claimedCount: drop.currentClaimants,
  };
}

// Inline lucide icon SVG for imperative DOM markers (no React needed).
const MUMBAI_CENTER: [number, number] = [72.833, 18.932];
// Jio World Centre, BKC — the Devcon venue the map opens on.
const DEVCON_VENUE: [number, number] = [72.8697, 19.0662];
const MUMBAI_PILOT_AREA: [number, number][] = [
  [72.79, 18.88], [72.88, 18.88], [72.96, 18.94], [73.01, 19.02],
  [73.00, 19.12], [72.96, 19.20], [72.88, 19.27], [72.78, 19.27],
  [72.75, 19.18], [72.76, 19.05],
];

function isInsideMumbai(longitude: number, latitude: number) {
  let inside = false;
  for (let i = 0, j = MUMBAI_PILOT_AREA.length - 1; i < MUMBAI_PILOT_AREA.length; j = i++) {
    const [xi, yi] = MUMBAI_PILOT_AREA[i];
    const [xj, yj] = MUMBAI_PILOT_AREA[j];
    const crosses = yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

const filters: { id: FilterKind; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "drop", label: "Drops" },
  { id: "person", label: "People" },
  { id: "event", label: "Events" },
  { id: "place", label: "Places" },
];

function geoFailure(error: GeolocationPositionError): "denied" | "timeout" | "unavailable" {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

function MarkerIcon({ kind, size = 16 }: { kind: MarkerKind; size?: number }) {
  if (kind === "drop") return <Gift size={size} strokeWidth={2.4} />;
  if (kind === "person") return <UsersRound size={size} strokeWidth={2.2} />;
  if (kind === "event") return <CalendarDays size={size} strokeWidth={2.2} />;
  return <MapPin size={size} strokeWidth={2.2} />;
}

const CLAIM_FEE_ABI = [{
  type: "function",
  name: "claim",
  stateMutability: "nonpayable",
  inputs: [
    { name: "dropId", type: "bytes32" },
    { name: "claimant", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "signature", type: "bytes" },
  ],
  outputs: [],
}] as const;

export default function CityHome() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapMarkersRef = useRef(new globalThis.Map<string, MapLibreMarker>());
  const [filter, setFilter] = useState<FilterKind>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardClosed, setCardClosed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [notice, setNotice] = useState("");
  const [youOpen, setYouOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [returnToFeedAfterProfile, setReturnToFeedAfterProfile] = useState(false);
  const [feedProfileStatus, setFeedProfileStatus] = useState<FeedProfileStatus>("checking");
  const [feedUserAddress, setFeedUserAddress] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [startChatAddress, setStartChatAddress] = useState<string | null>(null);
  const [socialView, setSocialView] = useState<SocialView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const introMount = useRef(Date.now());
  const [locationState, setLocationState] = useState<"checking" | "inside" | "outside" | "denied" | "unavailable" | "timeout">("checking");
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [outsidePromptOpen, setOutsidePromptOpen] = useState(false);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"stall" | "booth" | "event" | null>(null);
  const [placeMenu, setPlaceMenu] = useState<{ lat: number; lng: number } | null>(null);
  const [skipDropLocation, setSkipDropLocation] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [createError, setCreateError] = useState("");
  const [claimPin, setClaimPin] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimUnlocked, setClaimUnlocked] = useState(false);
  const [claimAskPin, setClaimAskPin] = useState(false);
  const [claimLocating, setClaimLocating] = useState(false);
  const [claimSigning, setClaimSigning] = useState(false);
  const [claimOutcome, setClaimOutcome] = useState<"success" | "failed" | null>(null);
  const [chainClaims, setChainClaims] = useState<Record<string, boolean>>({});
  const [chainCounts, setChainCounts] = useState<Record<string, number>>({});
  const [eventMarkers, setEventMarkers] = useState<CityMarker[]>([]);
  const [dropMarkers, setDropMarkers] = useState<CityMarker[]>([]);
  const [personMarkers, setPersonMarkers] = useState<CityMarker[]>([]);
  const [placeMarkers, setPlaceMarkers] = useState<CityMarker[]>([]);
  const [devLocationMode, setDevLocationMode] = useState<'off' | 'near' | 'far' | 'denied'>('off');
  const [locationSharing, setLocationSharing] = useState(true);
  const [locationPreferenceReady, setLocationPreferenceReady] = useState(false);
  const [friendMarkers, setFriendMarkers] = useState<Array<{ userId: string; username: string; latitude: number; longitude: number; verified: boolean }>>([]);
  const [testMarkers, setTestMarkers] = useState<CityMarker[]>([]);
  const [eventStatus, setEventStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [offline, setOffline] = useState(false);
  const locationStateRef = useRef(locationState);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3400);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    locationStateRef.current = locationState;
  }, [locationState]);
  const [tipTarget, setTipTarget] = useState<TipTarget | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [suggestedOpen, setSuggestedOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [createDropOpen, setCreateDropOpen] = useState(false);
  const [createDropLocation, setCreateDropLocation] = useState<{ lat: number; lng: number } | null>(null);
  const onMapTapRef = useRef<(lng: number, lat: number) => void>(() => {});
  const [dropLoading, setDropLoading] = useState(true);
  const [dropError, setDropError] = useState(false);

  const loadGame = useGameStore((s) => s.load);
  useEffect(() => {
    if (feedUserAddress) void loadGame(feedUserAddress);
  }, [feedUserAddress, loadGame]);

  const refreshFeedProfile = useCallback(async () => {
    setFeedProfileStatus("checking");
    setFeedUserAddress(null);
    try {
      const [{ authClient }, { walletForUser }] = await Promise.all([
        import("@/lib/auth-client"),
        import("@/lib/keystore"),
      ]);
      const session = await authClient.getSession();
      const user = (session?.data as { user?: { id: string; name?: string | null } } | null)?.user;
      if (!user) {
        setFeedProfileStatus("signed-out");
        return;
      }
      const wallet = await walletForUser(user.id, user.name);
      setFeedUserAddress(wallet?.address ?? null);
      setFeedProfileStatus(wallet ? "ready" : "wallet-needed");
    } catch {
      setFeedProfileStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!dropSheetOpen || !feedUserAddress) {
      setClaimUnlocked(false);
      return;
    }
    let active = true;
    const syncUnlock = () => {
      void import("@/lib/unlocked-wallet").then(({ getUnlockedPrivateKey }) => {
        if (active) setClaimUnlocked(Boolean(getUnlockedPrivateKey(feedUserAddress)));
      });
    };
    syncUnlock();
    window.addEventListener("focus", syncUnlock);
    return () => {
      active = false;
      window.removeEventListener("focus", syncUnlock);
    };
  }, [dropSheetOpen, feedUserAddress]);

  const refreshClaimStatus = useCallback(async () => {
    const params = new URLSearchParams();
    if (feedUserAddress) params.set("userAddress", feedUserAddress);
    try {
      const response = await fetch(`/api/claims/status?${params}`);
      if (!response.ok) return;
      const data = await response.json() as { drops?: { dropId: string; claimedByUser: boolean; currentClaimants: number }[] };
      const claimed: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      for (const drop of data.drops ?? []) {
        claimed[drop.dropId] = drop.claimedByUser;
        counts[drop.dropId] = drop.currentClaimants;
      }
      setChainClaims(claimed);
      setChainCounts(counts);
    } catch {
      // Keep the last chain or database snapshot. A failed refresh must not mark a drop claimed.
    }
  }, [feedUserAddress]);

  useEffect(() => {
    void refreshClaimStatus();
  }, [refreshClaimStatus]);

  useEffect(() => {
    void refreshFeedProfile();
    const onSession = () => { void refreshFeedProfile(); };
    window.addEventListener("devcity-session-changed", onSession);
    return () => window.removeEventListener("devcity-session-changed", onSession);
  }, [refreshFeedProfile]);

  useEffect(() => setHydrated(true), []);

  const { isConnected } = useAccount();
  const claim = useCityStore((s) => s.claim);
  const savedEvents = useCityStore((s) => s.savedEvents);
  const saveEvent = useCityStore((s) => s.saveEvent);
  const removeSavedEvent = useCityStore((s) => s.removeSavedEvent);
  const avatarMode = useCityStore((s) => s.avatarMode);
  const avatarSeed = useCityStore((s) => s.avatarSeed);
  const avatarImageData = useCityStore((s) => s.avatarImageData);
  const presenceStatus = useCityStore((s) => s.presenceStatus);
  const shuffleAvatar = useCityStore((s) => s.shuffleAvatar);

  useEffect(() => {
    if (!avatarSeed) shuffleAvatar();
  }, [avatarSeed, shuffleAvatar]);

  const allMarkers = useMemo(
    () => [...dropMarkers, ...eventMarkers, ...personMarkers, ...placeMarkers, ...testMarkers],
    [dropMarkers, eventMarkers, personMarkers, placeMarkers, testMarkers],
  );
  const kindById = useMemo(() => new globalThis.Map(allMarkers.map((item) => [item.id, item.kind] as const)), [allMarkers]);

  const visibleMarkers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return allMarkers.filter((marker) => {
      const matchesFilter = filter === "all" || marker.kind === filter;
      const matchesSearch = !normalizedSearch || `${marker.name} ${marker.detail}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [allMarkers, filter, searchTerm]);

  const selected = cardClosed
    ? undefined
    : selectedId
      ? visibleMarkers.find((marker) => marker.id === selectedId)
      : undefined;
  const selectedIsTest = Boolean(selected?.id.startsWith('test-'));
  const selectedDropId = selected?.kind === "drop" ? selected.id.replace(/^drop-/, "") : "";
  const isClaimed = Boolean(chainClaims[selectedDropId]);
  const selectedClaimedCount = selected?.kind === "drop" ? (chainCounts[selectedDropId] ?? selected.claimedCount) : selected?.claimedCount;
  const claimLocationStatus: ClaimLocationStatus = locationPreferenceReady && !locationSharing
    ? "off"
    : locationState === "denied"
    ? "denied"
    : locationState === "unavailable"
      ? "unavailable"
      : locationState === "timeout"
        ? "timeout"
      : locationState === "inside" || locationState === "outside"
        ? "ready"
        : "checking";
  const claimView = resolveClaimView({
    claimed: isClaimed || claimOutcome === "success",
    locating: claimLocating,
    signing: claimSigning,
    locationStatus: claimLocationStatus,
    userLat: myPosition ? myPosition[1] : null,
    userLng: myPosition ? myPosition[0] : null,
    dropLat: selected?.kind === "drop" ? selected.latitude : Number.NaN,
    dropLng: selected?.kind === "drop" ? selected.longitude : Number.NaN,
    failedMessage: claimOutcome === "failed" ? (claimError || "Claim failed. Nothing was claimed.") : null,
  });
  const connected = hydrated && (isConnected || (feedProfileStatus === "ready" && Boolean(feedUserAddress)));
  const claimFeeRequest = selected?.kind === "drop"
    ? {
      to: CELO_SEPOLIA.dropClaim as Address,
      data: encodeFunctionData({
        abi: CLAIM_FEE_ABI,
        functionName: "claim",
        args: [`0x${"0".repeat(64)}`, "0x0000000000000000000000000000000000000000", BigInt(0), BigInt(0), BigInt(0), "0x"],
      }),
    }
    : null;
  const claimFee = useFeeQuote(claimView.state === "ready" ? feedUserAddress : null, claimFeeRequest);

  useEffect(() => {
    const returning = new URLSearchParams(window.location.search).get('self') === 'done';
    if (returning || sessionStorage.getItem('devcity-self-check')) setYouOpen(true);
  }, []);

  useEffect(() => {
    setClaimAskPin(false);
    setClaimPin("");
    setClaimError("");
    setClaimOutcome(null);
    setClaimLocating(false);
    setClaimSigning(false);
  }, [selectedDropId]);

  useEffect(() => {
    function applyCityPath(path: string, fromHistory: boolean) {
      const drop = path.match(/^\/drop\/([^/]+)/);
      const event = path.match(/^\/event\/([^/]+)/);
      const user = path.match(/^\/u\/([^/]+)/);
      if (!drop && !event && !user) {
        if (fromHistory) {
          setDropSheetOpen(false);
          setYouOpen(false);
          setSelectedId(null);
        }
        return;
      }
      setWalletOpen(false);
      setScanOpen(false);
      setSocialView(null);
      setDropSheetOpen(Boolean(drop));
      setYouOpen(Boolean(user));
      if (drop) {
        setSelectedId(`drop-${decodeURIComponent(drop[1])}`);
        setCardClosed(false);
      } else if (event) {
        setSelectedId(`event-${decodeURIComponent(event[1])}`);
        setCardClosed(false);
      }
    }
    applyCityPath(window.location.pathname, false);
    const onPop = () => applyCityPath(window.location.pathname, true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const mapMarkers = mapMarkersRef.current;
    maplibregl.setWorkerUrl("/maplibre-gl-worker");
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: DEVCON_VENUE,
      zoom: 14.6,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.doubleClickZoom.disable();
    let pressTimer: number | null = null;
    let lastTapAt = 0;
    let lastTapLng = 0;
    let lastTapLat = 0;
    const isMarkerPress = (event: { originalEvent?: Event }) => {
      const target = event.originalEvent?.target;
      return target instanceof Element && Boolean(target.closest(".maplibregl-marker, .map-marker"));
    };
    const cancelPress = () => {
      if (pressTimer != null) window.clearTimeout(pressTimer);
      pressTimer = null;
    };
    const startPress = (lng: number, lat: number) => {
      cancelPress();
      pressTimer = window.setTimeout(() => {
        pressTimer = null;
        onMapTapRef.current(lng, lat);
      }, 550);
    };
    const noteTap = (lng: number, lat: number) => {
      const now = Date.now();
      const sameSpot = Math.abs(lng - lastTapLng) < 0.0008 && Math.abs(lat - lastTapLat) < 0.0008;
      if (now - lastTapAt < 350 && sameSpot) {
        lastTapAt = 0;
        cancelPress();
        onMapTapRef.current(lng, lat);
        return;
      }
      lastTapAt = now;
      lastTapLng = lng;
      lastTapLat = lat;
    };
    map.on("mousedown", (event) => { if (!isMarkerPress(event)) startPress(event.lngLat.lng, event.lngLat.lat); });
    map.on("touchstart", (event) => { if (!isMarkerPress(event)) startPress(event.lngLat.lng, event.lngLat.lat); });
    map.on("mouseup", (event) => { cancelPress(); if (!isMarkerPress(event)) noteTap(event.lngLat.lng, event.lngLat.lat); });
    map.on("touchend", (event) => {
      cancelPress();
      const point = event.lngLat ?? event.lngLats?.[0];
      if (point && !isMarkerPress(event)) noteTap(point.lng, point.lat);
    });
    map.on("dblclick", (event) => {
      if (isMarkerPress(event)) return;
      cancelPress();
      lastTapAt = 0;
      onMapTapRef.current(event.lngLat.lng, event.lngLat.lat);
    });
    map.on("movestart", cancelPress);
    map.on("load", () => {
      setMapReady(true);
      setMapError(false);
    });
    map.on("error", (event) => {
      console.error("City map error:", event.error);
      if (!mapReady) setMapError(true);
    });
    return () => {
      mapMarkers.forEach((marker) => marker.remove());
      mapMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Map initialization is intentionally one-time; interaction state is read in marker callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("events"))))
      .then((data: { events?: EventApiItem[] } | null) => {
        if (cancelled) return;
        const mapped = (data?.events ?? [])
          .map(eventToMarker)
          .filter((item): item is CityMarker => item !== null);
        setEventMarkers(mapped);
        setEventStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setEventStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDrops = useCallback(async () => {
    setDropLoading(true);
    setDropError(false);
    try {
      const response = await fetch("/api/drops");
      if (!response.ok) throw new Error("Could not load drops.");
      const data: { drops?: DropApiItem[] } = await response.json();
      const mapped = (data?.drops ?? [])
        .map(dropToMarker)
        .filter((item): item is CityMarker => item !== null);
      setDropMarkers((current) => {
        const existing = new globalThis.Map(current.map((m) => [m.id, m]));
        for (const marker of mapped) existing.set(marker.id, marker);
        return Array.from(existing.values());
      });
    } catch {
      setDropError(true);
    } finally {
      setDropLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshDrops();
    return () => {
      cancelled = true;
    };
  }, [refreshDrops]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/presence/nearby?lat=${DEVCON_VENUE[1]}&lng=${DEVCON_VENUE[0]}&radius=50`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { users?: Array<{ userId: string; username: string | null; lat: number; lng: number; distance: number }> } | null) => {
        if (cancelled || !data?.users) return;
        setPersonMarkers(data.users.filter((user) => Number.isFinite(user.lat) && Number.isFinite(user.lng)).map((user) => ({
          id: `person-${user.userId}`,
          kind: "person" as const,
          name: user.username || "Someone nearby",
          detail: "Approximate location",
          distance: `${user.distance} km`,
          latitude: user.lat,
          longitude: user.lng,
          color: "lime",
        })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/stalls').then((response) => (response.ok ? response.json() : { stalls: [] })),
      fetch('/api/booths').then((response) => (response.ok ? response.json() : { booths: [] })),
    ]).then(([stallsBody, boothsBody]: [
      { stalls?: Array<{ id: string; name: string; description?: string | null; latitude: number; longitude: number }> },
      { booths?: Array<{ id: string; name: string; description?: string | null; latitude: number; longitude: number }> },
    ]) => {
      if (cancelled) return;
      const places = [
        ...(stallsBody.stalls ?? []).map((item) => ({ ...item, prefix: 'stall', detail: item.description?.trim() || 'Stall' })),
        ...(boothsBody.booths ?? []).map((item) => ({ ...item, prefix: 'booth', detail: item.description?.trim() || 'Booth' })),
      ].filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      setPlaceMarkers(places.map((item) => ({
        id: `place-${item.prefix}-${item.id}`,
        kind: 'place' as const,
        name: item.name,
        detail: item.detail,
        distance: 'On the map',
        latitude: item.latitude,
        longitude: item.longitude,
        color: 'coral',
      })));
    }).catch(() => {
      if (!cancelled) setPlaceMarkers([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || eventMarkers.length === 0) return;
    const registry = mapMarkersRef.current;
    for (const [id, marker] of registry) {
      if (id.startsWith("event-")) {
        marker.remove();
        registry.delete(id);
      }
    }
    for (const marker of eventMarkers) {
      const element = document.createElement("button");
      element.type = "button";
      const isLive = marker.raw ? eventWhen(marker.raw) === 'live' : false;
      const isPast = marker.raw ? eventWhen(marker.raw) === 'past' : false;
      const pin = cityPinSvg({ kind: 'event', title: marker.name, live: isLive, past: isPast });
      element.className = `map-marker city-pin event-pin-marker${isLive ? ' is-live' : ''}${isPast ? ' is-past' : ''}`;
      element.setAttribute('aria-label', `${marker.name}, ${marker.distance}`);
      element.innerHTML = pin.svg;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: pin.anchor })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      registry.set(marker.id, mapMarker);
    }
  }, [eventMarkers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || dropMarkers.length === 0) return;
    const registry = mapMarkersRef.current;
    for (const [id, marker] of registry) {
      if (id.startsWith("drop-")) {
        marker.remove();
        registry.delete(id);
      }
    }
    for (const marker of dropMarkers) {
      const element = document.createElement("button");
      element.type = "button";
      const pin = cityPinSvg({ kind: 'drop', title: marker.tokenSymbol || marker.name });
      element.className = `map-marker city-pin marker-drop${chainClaims[marker.id.replace(/^drop-/, "")] ? " is-claimed" : ""}`;
      element.setAttribute("aria-label", `${marker.name}, ${marker.detail}`);
      element.innerHTML = pin.svg;
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
        setDropSheetOpen(true);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: pin.anchor })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      registry.set(marker.id, mapMarker);
    }
  }, [chainClaims, dropMarkers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const registry = mapMarkersRef.current;
    for (const [id, marker] of registry) {
      if (id.startsWith('person-') || id.startsWith('place-')) {
        marker.remove();
        registry.delete(id);
      }
    }
    for (const marker of [...personMarkers, ...placeMarkers]) {
      const element = document.createElement('button');
      element.type = 'button';
      const pin = cityPinSvg({ kind: marker.kind === 'person' ? 'person' : 'place', title: marker.name });
      element.className = `map-marker city-pin marker-${marker.kind}`;
      element.setAttribute('aria-label', `${marker.name}, ${marker.detail}`);
      element.innerHTML = pin.svg;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: pin.anchor })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      registry.set(marker.id, mapMarker);
    }
  }, [mapReady, personMarkers, placeMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const registry = mapMarkersRef.current;
    for (const [id, marker] of registry) {
      if (id.startsWith('friend-')) {
        marker.remove();
        registry.delete(id);
      }
    }
    const visibleFriends = filter === 'all' || filter === 'person' ? friendMarkers : [];
    for (const friend of visibleFriends) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'friend-map-icon';
      element.setAttribute('aria-label', friend.verified ? `${friend.username}, verified friend` : `${friend.username}, friend`);
      const avatar = document.createElement('img');
      avatar.src = dicebearAvatarUrl(friend.username);
      avatar.alt = '';
      element.append(avatar);
      if (friend.verified) {
        const tick = document.createElement('span');
        tick.className = 'friend-tick';
        tick.textContent = '✓';
        element.append(tick);
      }
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setNotice(friend.verified ? `${friend.username} is verified` : friend.username);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([friend.longitude, friend.latitude])
        .addTo(map);
      registry.set(`friend-${friend.userId}`, mapMarker);
    }
  }, [filter, friendMarkers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const registry = mapMarkersRef.current;
    for (const [id, marker] of registry) {
      if (id.startsWith('test-')) {
        marker.remove();
        registry.delete(id);
      }
    }
    for (const marker of testMarkers) {
      const element = document.createElement('button');
      element.type = 'button';
      const pin = cityPinSvg({
        kind: marker.kind === 'person' ? 'person' : marker.kind,
        title: marker.name,
      });
      element.className = 'map-marker city-pin marker-test';
      element.setAttribute('aria-label', `TEST. ${marker.name}. ${marker.detail}`);
      element.innerHTML = pin.svg;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
        if (marker.kind === 'drop') setDropSheetOpen(true);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: pin.anchor })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      registry.set(marker.id, mapMarker);
    }
  }, [mapReady, testMarkers]);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    if (mapReady || mapError) {
      const elapsed = Date.now() - introMount.current;
      const wait = Math.max(0, 1800 - elapsed);
      const timer = window.setTimeout(() => setShowIntro(false), (mapReady ? 420 : 1200) + wait);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setShowIntro(false);
      setMapError(true);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [mapError, mapReady]);

  // Check onboarding status
  useEffect(() => {
    const completed = localStorage.getItem('devcity_onboarding_completed');
    setHasCompletedOnboarding(!!completed);

    if (!completed && !showIntro && mapReady) {
      setShowOnboarding(true);
    }
  }, [showIntro, mapReady]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('devcity_onboarding_completed', 'true');
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  useEffect(() => {
    setLocationSharing(localStorage.getItem('devcity-location-sharing') !== 'off');
    setLocationPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!locationPreferenceReady || !locationSharing || !myPosition) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/me/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharing: true, longitude: myPosition[0], latitude: myPosition[1] }),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [locationPreferenceReady, locationSharing, myPosition]);

  useEffect(() => {
    let cancelled = false;
    async function loadFriends() {
      const response = await fetch('/api/friends/map');
      if (!response.ok) return;
      const data = await response.json() as { friends?: Array<{ userId: string; username: string; latitude: number; longitude: number; verified: boolean }> };
      if (!cancelled) setFriendMarkers(data.friends ?? []);
    }
    void loadFriends().catch(() => {});
    const onChange = () => { void loadFriends().catch(() => {}); };
    window.addEventListener('devcity-friends-changed', onChange);
    const timer = window.setInterval(onChange, 20000);
    return () => {
      cancelled = true;
      window.removeEventListener('devcity-friends-changed', onChange);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!locationPreferenceReady) return;
    if (!locationSharing) {
      setMyPosition(null);
      return;
    }
    if (process.env.NODE_ENV !== 'production' && devLocationMode !== 'off') return;
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      setLocationPromptOpen(true);
      return;
    }
    let settled = false;
    const accept = (coords: GeolocationCoordinates) => {
      const position: [number, number] = [coords.longitude, coords.latitude];
      setMyPosition(position);
      const inside = isInsideMumbai(position[0], position[1]);
      setLocationState(inside ? "inside" : "outside");
      setLocationPromptOpen(false);
      if (settled) return;
      settled = true;
      if (inside) mapRef.current?.flyTo({ center: position, zoom: 16, duration: 1100 });
      else setOutsidePromptOpen(true);
    };
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => accept(coords),
      (error) => {
        if (settled) return;
        if (error.code !== error.TIMEOUT) {
          setLocationState(geoFailure(error));
          setLocationPromptOpen(true);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => accept(coords),
          (retryError) => {
            if (settled) return;
            setLocationState(geoFailure(retryError));
            setLocationPromptOpen(true);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [devLocationMode, locationPreferenceReady, locationSharing]);

  useEffect(() => {
    mapMarkersRef.current.forEach((marker, id) => {
      const visible = filter === "all" || kindById.get(id) === filter || (id.startsWith('friend-') && filter === 'person');
      marker.getElement().classList.toggle("marker-filtered-out", !visible);
      marker.getElement().classList.toggle("marker-selected", selected?.id === id);
    });
    if (selected && mapReady) {
      mapRef.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 15, duration: 650 });
    }
  }, [dropMarkers, eventMarkers, personMarkers, placeMarkers, friendMarkers, filter, kindById, mapReady, selected]);

  useEffect(() => {
    if (!mapReady || !myPosition) return;
    const element = document.createElement("div");
    element.className = `my-location-marker${presenceStatus === 'offline' ? ' my-location-offline' : ''}`;
    const avatarSrc = avatarMode === "upload" && avatarImageData
      ? avatarImageData
      : dicebearAvatarUrl(avatarSeed || "devcity26");
    const avatar = document.createElement("img");
    avatar.src = avatarSrc;
    avatar.alt = "";
    element.append(avatar);
    if (presenceStatus !== 'offline') {
      const status = document.createElement('i');
      status.className = `my-location-status status-${presenceStatus}`;
      element.append(status);
    }
    const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(myPosition).addTo(mapRef.current!);
    const wrapper = marker.getElement().parentElement;
    if (wrapper) wrapper.style.zIndex = "8";
    return () => {
      marker.remove();
    };
  }, [avatarImageData, avatarMode, avatarSeed, mapReady, myPosition, presenceStatus]);

  function tokenFor(marker: CityMarker) {
    return marker.tokenSymbol ?? "TOKENS";
  }

  function readFreshClaimPosition(): Promise<{ lat: number; lng: number }> {
    if (process.env.NODE_ENV !== 'production' && devLocationMode !== 'off') {
      return new Promise((resolve, reject) => {
        if (devLocationMode === 'denied' || !myPosition) {
          reject(Object.assign(new Error('Location permission is required.'), { claimLocation: 'denied' as const }));
          return;
        }
        resolve({ lat: myPosition[1], lng: myPosition[0] });
      });
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(Object.assign(new Error("Location is unavailable."), { claimLocation: "unavailable" as const }));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
            reject(Object.assign(new Error("Location is unavailable."), { claimLocation: "unavailable" as const }));
            return;
          }
          resolve({ lat: coords.latitude, lng: coords.longitude });
        },
        (error) => {
          const where = geoFailure(error);
          const message = where === "denied"
            ? "Location permission is required."
            : where === "timeout"
              ? "Location is on, but this reading timed out."
              : "This device could not find a position.";
          reject(Object.assign(new Error(message), { claimLocation: where }));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 20000 },
      );
    });
  }

  async function handleClaim() {
    if (!selected || selected.kind !== "drop" || claimSigning || claimLocating) return;
    if (selected.id.startsWith('test-')) return;
    const myAddress = feedUserAddress;
    if (!myAddress) {
      openWallet();
      return;
    }
    const dropId = selected.id.replace(/^drop-/, "");
    const dropLat = selected.latitude;
    const dropLng = selected.longitude;
    setClaimError("");
    setClaimOutcome(null);
    setClaimLocating(true);
    let fresh: { lat: number; lng: number };
    try {
      fresh = await readFreshClaimPosition();
    } catch (error) {
      const where = (error as { claimLocation?: "denied" | "timeout" | "unavailable" }).claimLocation ?? "unavailable";
      setMyPosition(null);
      setLocationState(where);
      setLocationPromptOpen(true);
      setClaimLocating(false);
      return;
    }
    setMyPosition([fresh.lng, fresh.lat]);
    setLocationState(isInsideMumbai(fresh.lng, fresh.lat) ? "inside" : "outside");
    const metersAway = distanceMeters(fresh.lat, fresh.lng, dropLat, dropLng);
    if (metersAway > CLAIM_RADIUS_M) {
      setClaimLocating(false);
      return;
    }
    try {
      const { getUnlockedPrivateKey, rememberUnlockedWallet } = await import("@/lib/unlocked-wallet");
      let key = getUnlockedPrivateKey(myAddress);
      const pinStep = claimNeedsPin(Boolean(key), claimPin);
      if (pinStep === "ask") {
        setClaimAskPin(true);
        setClaimLocating(false);
        if (claimPin.length > 0) {
          setClaimOutcome("failed");
          setClaimError("Enter your 6-digit wallet PIN. Nothing was claimed.");
        }
        return;
      }
      if (pinStep === "unlock") {
        const { loadLocalWallet, decryptWithPassphrase } = await import("@/lib/keystore");
        const local = await loadLocalWallet(myAddress as `0x${string}`);
        if (!local) throw new Error("This account’s wallet is not on this device.");
        try {
          key = (await decryptWithPassphrase(claimPin, local.encryptedPrivateKey)) as `0x${string}`;
        } catch {
          throw new Error("That PIN didn't unlock this wallet.");
        }
        rememberUnlockedWallet(local.address, key);
        setClaimPin("");
        setClaimAskPin(false);
        setClaimUnlocked(true);
      } else {
        setClaimAskPin(false);
      }
      if (!key) throw new Error("This account’s wallet is not unlocked.");
      setClaimLocating(false);
      setClaimSigning(true);
      setClaiming(true);
      const response = await fetch("/api/claims/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropId,
          userAddress: myAddress,
          lat: fresh.lat,
          lng: fresh.lng,
        }),
      });
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        dropIdBytes32?: `0x${string}`;
        claimer?: `0x${string}`;
        amount?: string;
        nonce?: string;
        expiresAt?: string;
        signature?: `0x${string}`;
      };
      if (!response.ok) throw new Error(data.error || "Claim could not be authorized.");
      if (!data.dropIdBytes32 || !data.claimer || !data.amount || data.nonce == null || data.expiresAt == null || !data.signature) {
        throw new Error("Claim authorization was incomplete.");
      }
      const { createPublicClient, createWalletClient, http } = await import("viem");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { celoSepolia } = await import("viem/chains");
      const { CELO_SEPOLIA } = await import("@/lib/chain");
      const account = privateKeyToAccount(key);
      if (account.address.toLowerCase() !== myAddress.toLowerCase()) {
        throw new Error("The unlocked key does not match this account’s wallet.");
      }
      const transport = http(CELO_SEPOLIA.rpcUrl);
      const walletClient = createWalletClient({ account, chain: celoSepolia, transport });
      const publicClient = createPublicClient({ chain: celoSepolia, transport });
      const hash = await writeContractWithFee(walletClient, {
        account,
        address: CELO_SEPOLIA.dropClaim,
        abi: CLAIM_FEE_ABI,
        functionName: "claim",
        args: [data.dropIdBytes32, data.claimer, BigInt(data.amount), BigInt(data.nonce), BigInt(data.expiresAt), data.signature],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The claim transaction failed. Nothing was claimed.");
      claim(selected.id, selected.name, tokenFor(selected), selected.amount ?? "1", hash);
      setChainClaims((current) => ({ ...current, [dropId]: true }));
      setClaimOutcome("success");
      setClaimAskPin(false);
      void refreshClaimStatus();
      setNotice(`Claim successful. ${selected.amount} ${tokenFor(selected)} is in your wallet.`);
    } catch (error) {
      setClaimOutcome("failed");
      setClaimError(claimFailureMessage(error));
    } finally {
      setClaimLocating(false);
      setClaimSigning(false);
      setClaiming(false);
    }
  }

  async function handleCreatePlace() {
    if (!createKind || !createName.trim()) return;
    setCreatingPlace(true);
    setCreateError("");
    try {
      const ownerId = feedUserAddress;
      if (!ownerId) {
        openWallet();
        setCreateError("Create a passkey wallet first to set up a spot.");
        return;
      }
      const lat = createDropLocation?.lat ?? (myPosition ? myPosition[1] : 19.0662);
      const lng = createDropLocation?.lng ?? (myPosition ? myPosition[0] : 72.8697);
      const endpoint = createKind === "stall" ? "/api/stalls" : createKind === "event" ? "/api/events" : "/api/booths";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          name: createName.trim(),
          lat,
          lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create.");
      const label = createKind === "stall" ? "Stall" : createKind === "event" ? "Event" : "Spot";
      setNotice(`${label} "${createName.trim()}" created.`);
      if (createKind === "event") {
        const response = await fetch("/api/events");
        if (response.ok) {
          const events = (await response.json()) as { events?: EventApiItem[] };
          setEventMarkers((events.events ?? []).map(eventToMarker).filter((item): item is CityMarker => item !== null));
        }
      }
      setCreateKind(null);
      setCreateName("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create. Try again.");
    } finally {
      setCreatingPlace(false);
    }
  }

  function chooseTab(tab: NavTab) {
    closeSheets(tab === "wallet" ? "wallet" : tab === "feed" || tab === "chat" ? "social" : undefined);
    setActiveTab(tab);
    setNotice("");
    if (tab === "map") setFilter("all");
    if (tab === "feed" || tab === "chat") setSocialView(tab);
    if (tab === "wallet") setWalletOpen(true);
  }

  function chooseFilter(nextFilter: FilterKind) {
    setFilter(nextFilter);
    setSocialView(null);
    setActiveTab("map");
    setCardClosed(false);
    setSelectedId(null);
    setDropSheetOpen(false);
  }

  function exploreMumbai() {
    setOutsidePromptOpen(false);
    setLocationPromptOpen(false);
    mapRef.current?.flyTo({ center: MUMBAI_CENTER, zoom: 14.1, duration: 1100 });
  }

  function applyDevLocation(next: DevLocationApply) {
    if (process.env.NODE_ENV === 'production') return;
    setDevLocationMode(next.mode);
    const places = next.places.filter((place) => place.id.startsWith('test-') && place.name.startsWith('TEST '));
    setTestMarkers(next.mode === 'off' ? [] : places.map((place) => ({
      id: place.id,
      kind: place.kind,
      name: place.name,
      detail: place.detail,
      distance: 'TEST',
      latitude: place.latitude,
      longitude: place.longitude,
      color: 'coral',
      amount: place.kind === 'drop' ? 'TEST' : undefined,
      tokenSymbol: place.kind === 'drop' ? 'TEST' : undefined,
    })));
    if (next.mode === 'off') {
      setMyPosition(null);
      setLocationState('checking');
      return;
    }
    if (next.mode === 'denied' || !next.position) {
      setMyPosition(null);
      setLocationState('denied');
      setLocationPromptOpen(true);
      setOutsidePromptOpen(false);
      return;
    }
    const position: [number, number] = [next.position.longitude, next.position.latitude];
    setMyPosition(position);
    const inside = isInsideMumbai(position[0], position[1]);
    setLocationState(inside ? 'inside' : 'outside');
    setLocationPromptOpen(false);
    setOutsidePromptOpen(!inside);
    mapRef.current?.flyTo({ center: position, zoom: 16, duration: 800 });
  }

  async function toggleLocationSharing() {
    const next = !locationSharing;
    setLocationSharing(next);
    localStorage.setItem('devcity-location-sharing', next ? 'on' : 'off');
    if (!next) {
      setMyPosition(null);
      setLocationPromptOpen(false);
      setOutsidePromptOpen(false);
    }
    await fetch('/api/me/location', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sharing: next }),
    }).catch(() => {});
    setNotice(next ? 'Location is on for friends.' : 'Location is off. Friends cannot see you.');
  }

  function requestLocation() {
    if (!locationSharing) {
      setLocationSharing(true);
      localStorage.setItem('devcity-location-sharing', 'on');
      void fetch('/api/me/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharing: true }),
      });
    }
    if (process.env.NODE_ENV !== 'production' && devLocationMode !== 'off') {
      if (devLocationMode === 'denied') {
        setLocationState('denied');
        setLocationPromptOpen(true);
      }
      setRequestingLocation(false);
      return;
    }
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }
    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude];
        setMyPosition(position);
        setRequestingLocation(false);
        setLocationPromptOpen(false);
        if (isInsideMumbai(position[0], position[1])) {
          setLocationState("inside");
          mapRef.current?.flyTo({ center: position, zoom: 15, duration: 1100 });
        } else {
          setLocationState("outside");
          setOutsidePromptOpen(true);
        }
      },
      (error) => {
        setRequestingLocation(false);
        setLocationState(geoFailure(error));
        setLocationPromptOpen(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }

  const openCreateDrop = useCallback((location?: { lat: number; lng: number } | null) => {
    setCreateMenuOpen(false);
    setCityMenuOpen(false);
    setYouOpen(false);
    setWalletOpen(false);
    setScanOpen(false);
    setSocialView(null);
    setDropSheetOpen(false);
    setSearchSheetOpen(false);
    setTipTarget(null);
    setNotificationsOpen(false);
    setSkipDropLocation(false);
    setCreateDropLocation(location ?? (myPosition ? { lat: myPosition[1], lng: myPosition[0] } : null));
    setCreateDropOpen(true);
  }, [myPosition]);

  useEffect(() => {
    onMapTapRef.current = (lng, lat) => {
      if (!feedUserAddress) {
        setNotice("Create a passkey wallet to publish drops.");
        openWallet();
        return;
      }
      setYouOpen(false);
      setWalletOpen(false);
      setScanOpen(false);
      setSocialView(null);
      setDropSheetOpen(false);
      setSearchSheetOpen(false);
      setTipTarget(null);
      setNotificationsOpen(false);
      setCreateDropLocation({ lat, lng });
      setPlaceMenu({ lat, lng });
    };
  }, [feedUserAddress]);

  function handleDropCreated() {
    void refreshDrops();
  }

  function rememberPath(path: string) {
    if (window.location.pathname === path) return;
    window.history.pushState({ devcity: path }, "", path);
  }

  function closeSheets(except?: "you" | "wallet" | "scan" | "social" | "drop" | "search" | "tip" | "create" | "notes") {
    if (except !== "you") setYouOpen(false);
    if (except !== "wallet") setWalletOpen(false);
    if (except !== "scan") setScanOpen(false);
    if (except !== "social") setSocialView(null);
    if (except !== "drop") setDropSheetOpen(false);
    if (except !== "search") setSearchSheetOpen(false);
    if (except !== "tip") setTipTarget(null);
    if (except !== "create") setCreateDropOpen(false);
    if (except !== "notes") setNotificationsOpen(false);
    setTrendingOpen(false);
    setLeaderboardOpen(false);
    setSuggestedOpen(false);
    setActiveStory(null);
  }

  function openProfile() {
    closeSheets("you");
    setReturnToFeedAfterProfile(false);
    setActiveTab("map");
    setYouOpen(true);
    rememberPath("/u/you");
  }

  function openWallet() {
    closeSheets("wallet");
    setActiveTab("wallet");
    setWalletOpen(true);
  }

  function openProfileFromFeed() {
    setReturnToFeedAfterProfile(true);
    setSocialView(null);
    setActiveTab("map");
    setWalletOpen(false);
    setYouOpen(true);
  }

  function closeProfile() {
    setYouOpen(false);
    void refreshFeedProfile();
    if (returnToFeedAfterProfile) {
      setReturnToFeedAfterProfile(false);
      setSocialView("feed");
      setActiveTab("feed");
    }
  }

  function closeWallet() {
    setWalletOpen(false);
    setActiveTab("map");
    void refreshFeedProfile();
  }

  function notifyChat(message: string) {
    setNotice(message);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('DEVCITY26', { body: message, icon: '/devcity-mark.svg' });
    }
  }

  function messageUser(address: string, username: string) {
    setSearchSheetOpen(false);
    setStartChatAddress(address);
    setSocialView('chat');
    setActiveTab('chat');
    setNotice(`Start a chat with ${username || address.slice(0, 6)}…${address.slice(-4)}`);
  }

  async function enableChatNotifications() {
    if (typeof Notification === 'undefined') {
      setNotice('This browser does not support desktop notifications. In-app alerts remain on.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(permission === 'granted' ? 'Message notifications enabled.' : 'You can still see new messages while DEVCITY is open.');
  }

  const currentAvatarSrc = avatarMode === 'upload' && avatarImageData
    ? avatarImageData
    : avatarMode === 'dicebear' && avatarSeed
      ? dicebearAvatarUrl(avatarSeed)
      : undefined;

  function directionsUrl(marker: CityMarker) {
    const destination = `${marker.latitude.toFixed(3)},${marker.longitude.toFixed(3)}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
  }

  return (
    <main className="app-shell">
      <section className="city-stage" id="city" aria-label="City map">
        <div ref={mapContainer} className="real-city-map" aria-label="City map" />
        <div className="map-tint vignette" aria-hidden="true" />
        {showIntro && <div className={`city-intro${mapReady ? " is-leaving" : ""}`} aria-live="polite">
          <Image className="city-loader-art" src="/assets/loading.svg" alt="DEVCITY26" width={104} height={104} priority unoptimized />
          <strong>DEVCITY 26</strong>
          <span className="intro-loading">{mapReady ? "CITY READY" : mapError ? "CITY MAP IS SLOW" : "LOADING CITY"}<i /><i /><i /></span>
        </div>}
        {showOnboarding && !hasCompletedOnboarding && (
          <OnboardingFlow onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
        )}
        {mapError && <div className="map-load-notice" role="status">
          <span>{mapReady ? "Some map details are taking a moment." : "The map is taking a moment to arrive."}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>}

        {dropLoading && <div className="map-drops-status" role="status"><span className="spinner" /> Loading drops…</div>}
        {!dropLoading && dropError && (
          <div className="map-drops-status is-error" role="status">Couldn&apos;t load drops. <button onClick={() => void refreshDrops()}>Retry</button></div>
        )}
        {!dropLoading && !dropError && dropMarkers.length === 0 && devLocationMode === 'off' && (
          <div className="map-drops-status" role="status">No live drops yet. Press and hold, or double-press, the map to create one.</div>
        )}
        {devLocationMode !== 'off' && (
          <div className="map-drops-status" role="status">TEST location is on. These places and events are not real.</div>
        )}
        {locationPreferenceReady && !locationSharing && (
          <div className="map-drops-status" role="status">Location is off. Friends cannot see you on the map.</div>
        )}

        {offline && <div className="map-drops-status is-error" role="status">You are offline. The map will catch up when the connection returns.</div>}
        {eventStatus === 'error' && <div className="map-drops-status is-error" role="status">Couldn&apos;t load events. <button onClick={() => window.location.reload()}>Retry</button></div>}
        <DevLocationGate onChange={applyDevLocation} />

        <header className="topbar">
          <div className="top-actions">
            <button className="round-action" onClick={() => { setCityMenuOpen((v) => !v); }} aria-label="City hub" title="City hub">
              <GameIcon name="spark" size={20} />
            </button>
            <button
              className={`round-action${locationSharing ? '' : ' is-location-off'}`}
              onClick={() => void toggleLocationSharing()}
              aria-pressed={locationSharing}
              aria-label={locationSharing ? 'Turn location off' : 'Turn location on'}
              title={locationSharing ? 'Location is on' : 'Location is off'}
            >{locationSharing ? <MapPin size={18} /> : <MapPinOff size={18} />}</button>
            <button className={`top-profile-button${youOpen ? " is-active" : ""}`} onClick={openProfile} aria-label="Open your profile" title="Your profile">
              <img src={currentAvatarSrc ?? dicebearAvatarUrl(avatarSeed || "devcity26")} alt="" />
            </button>
          </div>
        </header>

        <div className="map-tools">
          <div className="filter-list" role="group" aria-label="Filter map">
            {filters.map((item) => <button key={item.id} className={`filter-chip ${filter === item.id ? "is-selected" : ""}`} onClick={() => chooseFilter(item.id)}>{item.label}</button>)}
          </div>
          <button className="locate-button" onClick={() => setCreateMenuOpen((v) => !v)} aria-label="Create a stall or booth" title="Create"><Plus size={18} /></button>
        </div>

        {(createMenuOpen || cityMenuOpen) && (
          <div className="create-menu city-hub" role="menu">
            {createMenuOpen && (
              <>
                <span className="city-hub-label">Create in the city</span>
                <button className="create-menu-item" role="menuitem" onClick={() => { setCreateKind("stall"); setCreateMenuOpen(false); }}><BuildingSprite id="cafe" size={30} /> Create stall</button>
                <button className="create-menu-item" role="menuitem" onClick={() => { setCreateKind("booth"); setCreateMenuOpen(false); }}><BuildingSprite id="booth" size={30} /> Create booth</button>
                <button className="create-menu-item" role="menuitem" onClick={() => openCreateDrop()}><Gift size={16} /> Create a drop</button>
              </>
            )}
            {cityMenuOpen && (
              <>
                <span className="city-hub-label">City hub</span>
                <button className="create-menu-item" role="menuitem" onClick={() => { closeSheets(); setTrendingOpen(true); }}><TrendingUp size={16} /> Trending</button>
                <button className="create-menu-item" role="menuitem" onClick={() => { closeSheets(); setLeaderboardOpen(true); }}><Trophy size={16} /> Leaderboard</button>
                <button className="create-menu-item" role="menuitem" onClick={() => { closeSheets(); setSuggestedOpen(true); }}><UsersRound size={16} /> Who to follow</button>
              </>
            )}
          </div>
        )}

        {selectedIsTest && selected && selected.kind !== 'drop' && (
          <div className="test-place-card" role="status">
            <strong>TEST</strong>
            <p>{selected.name}</p>
            <p>{selected.detail}</p>
          </div>
        )}

        {selected && !selectedIsTest && (selected.kind === "event" && selected.raw ? (
          <EventCard
            event={selected.raw}
            onClose={() => setCardClosed(true)}
            onShowOnMap={() => mapRef.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 15.5, duration: 900 })}
            attendance={savedEvents.find((event) => event.id === selected.raw?.id)?.attendance ?? null}
            onToggleGoing={() => {
              const event = selected.raw;
              if (!event || (eventWhen(event) !== 'upcoming' && eventWhen(event) !== 'live')) return;
              const saved = savedEvents.find((item) => item.id === event.id);
              if (saved) {
                if (saved.attendance === "going") removeSavedEvent(saved.id);
                return;
              }
              saveEvent({
                id: event.id,
                name: event.name,
                organizer: event.organizer,
                location: event.location,
                startDate: event.startDate,
                url: event.url,
              });
            }}
          />
        ) : (
        <article className={`activity-card ${selected.kind === "drop" ? "drop-card" : ""}`} aria-live="polite">
          <div className="card-topline">
            <span className={`card-icon tone-${selected.color}`}><MarkerIcon kind={selected.kind} size={17} /></span>
            <span className="card-kind">{selected.kind === "drop" ? "TOKEN DROP" : selected.kind.toUpperCase()}</span>
            <button className="card-more" onClick={() => {
              if (selected.kind === "drop") {
                closeSheets("drop");
                setDropSheetOpen(true);
                rememberPath(`/drop/${selected.id.replace(/^drop-/, "")}`);
              } else if (selected.kind === "event") {
                rememberPath(`/event/${selected.id.replace(/^event-/, "")}`);
              } else {
                window.open(directionsUrl(selected), "_blank", "noopener,noreferrer");
              }
            }} aria-label="More details"><ArrowUpRight size={17} /></button>
            <button className="card-close" onClick={() => setCardClosed(true)} aria-label="Close details"><X size={17} /></button>
          </div>
          <h2>{selected.name}</h2>
          <p className="card-description">{selected.detail}</p>
          <div className="card-meta"><span><MapPin size={13} /> {selected.kind === "drop" ? (claimView.distanceM != null ? claimDistanceSentence(claimView.distanceM) : claimView.title) : selected.distance}</span>{selected.kind === "drop" && typeof selectedClaimedCount === "number" && <span className="claim-count">{selectedClaimedCount} claimed</span>}</div>
          {selected.kind === "drop" ? (
            <button
              className={`claim-button ${isClaimed ? "is-claimed" : ""}`}
              onClick={() => { closeSheets("drop"); setClaimError(""); setClaimPin(""); setDropSheetOpen(true); rememberPath(`/drop/${selected.id.replace(/^drop-/, "")}`); }}
              disabled={isClaimed || claiming}
            >
              {isClaimed ? "Added to your tokens" : "Open drop"}
            </button>
          ) : selected.kind === "person" ? (
            <div className="card-actions">
              <a className="secondary-action" href={directionsUrl(selected)} target="_blank" rel="noreferrer" aria-label={`Walking directions to the approximate ${selected.name} map area`}>
                <MapPin size={15} /> Walk there
              </a>
              <button
                className="tip-action"
                onClick={() => setTipTarget({ name: selected.name, initials: selected.initials ?? selected.name[0], color: selected.color })}
              >
                <Heart size={15} /> Tip
              </button>
              <button className="secondary-action" onClick={() => { closeSheets("social"); setActiveTab('chat'); setSocialView('chat'); }}>
                <MessageCircle size={15} /> Say hello
              </button>
            </div>
          ) : selected.kind === "event" && selected.url ? (
            <a className="secondary-action" href={selected.url} target="_blank" rel="noreferrer">
              View event
            </a>
          ) : (
            <a className="secondary-action" href={directionsUrl(selected)} target="_blank" rel="noreferrer">
              Walking directions
            </a>
          )}
          <p className="prototype-note">{selected.kind === "drop" ? claimView.title : connected ? "Ready when you are" : "Join the city to claim and tip"}</p>
        </article>))}

        {notice && <div className="notice-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}

        <nav className="mobile-nav" aria-label="Main navigation">
          <button className={activeTab === "map" ? "is-active" : ""} onClick={() => chooseTab("map")} aria-label="Map"><span className="nav-glyph"><NavIcon name="map" /></span></button>
          <button className={activeTab === "feed" ? "is-active" : ""} onClick={() => chooseTab("feed")} aria-label="Feed"><span className="nav-glyph"><NavIcon name="feed" /></span></button>
          <button className={scanOpen ? "is-active" : ""} onClick={() => { closeSheets("scan"); setScanOpen(true); }} aria-label="Scan a QR code"><span className="nav-glyph"><NavIcon name="scan" /></span></button>
          <button className={activeTab === "chat" ? "is-active" : ""} onClick={() => chooseTab("chat")} aria-label="Inbox"><span className="nav-glyph"><NavIcon name="inbox" /></span></button>
          <button className={activeTab === "wallet" ? "is-active" : ""} onClick={() => chooseTab("wallet")} aria-label="Wallet"><span className="nav-glyph"><NavIcon name="wallet" /></span></button>
        </nav>
      </section>

      <YouSheet open={youOpen} onClose={closeProfile} onOpenWallet={openWallet} onOpenNotifications={() => { closeSheets("notes"); setNotificationsOpen(true); }} />
      <WalletSheet
        open={walletOpen}
        onClose={closeWallet}
        notify={setNotice}
        onCreateDrop={() => {
          setWalletOpen(false);
          setActiveTab("map");
          openCreateDrop();
        }}
      />
      <ScanSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onTip={(target) => { closeSheets("tip"); setTipTarget(target); }}
        onOpenDrop={(dropId) => {
          closeSheets("drop");
          setSelectedId(`drop-${dropId}`);
          setCardClosed(false);
          setDropSheetOpen(true);
          setActiveTab("map");
          rememberPath(`/drop/${dropId}`);
        }}
      />
      <SearchSheet
        open={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        onMessageUser={messageUser}
      />
      <CitySocialSheet
        open={socialView !== null}
        view={socialView}
        avatarSrc={currentAvatarSrc}
        profileStatus={feedProfileStatus}
        userAddress={feedUserAddress}
        onRequestProfile={openProfileFromFeed}
        onNotify={notifyChat}
        onConnectWallet={openWallet}
        onEnableNotifications={() => void enableChatNotifications()}
        notificationsEnabled={typeof Notification !== 'undefined' && Notification.permission === 'granted'}
        onClose={() => { setSocialView(null); setActiveTab("map"); }}
        onTip={(name, initials, color, address) => { closeSheets("tip"); setTipTarget({ name, initials, color, address }); }}
        startChatAddress={startChatAddress}
      />
      <TipSheet
        open={tipTarget !== null}
        onClose={() => setTipTarget(null)}
        target={tipTarget}
        onNeedWallet={openWallet}
        notify={setNotice}
      />
      <TrendingSheet open={trendingOpen} onClose={() => setTrendingOpen(false)} />
      <LeaderboardSheet open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <NotificationSheet open={notificationsOpen} userAddress={feedUserAddress} onClose={() => setNotificationsOpen(false)} />
      <SuggestedUsersSheet
        open={suggestedOpen}
        userAddress={feedUserAddress}
        onClose={() => setSuggestedOpen(false)}
        onFollow={() => setNotice("Following that person.")}
      />
      <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
      {placeMenu && (
        <Sheet open onClose={() => setPlaceMenu(null)} title="Add here">
          <div className="place-choices" role="menu">
            <span className="city-hub-label">This spot</span>
            <button className="create-menu-item" role="menuitem" onClick={() => { setSkipDropLocation(true); setCreateDropOpen(true); setPlaceMenu(null); }}><Gift size={16} /> Drop</button>
            <button className="create-menu-item" role="menuitem" onClick={() => { setCreateKind("event"); setCreateName(""); setPlaceMenu(null); }}><CalendarDays size={16} /> Event</button>
            <button className="create-menu-item" role="menuitem" onClick={() => { setCreateKind("stall"); setCreateName(""); setPlaceMenu(null); }}><BuildingSprite id="cafe" size={30} /> Stall</button>
            <button className="create-menu-item" role="menuitem" onClick={() => { setCreateKind("booth"); setCreateName(""); setPlaceMenu(null); }}><BuildingSprite id="booth" size={30} /> Other</button>
          </div>
        </Sheet>
      )}
      {createKind && (
        <Sheet
          open
          onClose={() => { setCreateKind(null); setCreateName(""); }}
          title={createKind === "stall" ? "Create a stall" : createKind === "event" ? "Create an event" : "Create something else"}
        >
          <div className="drop-sheet-content">
            <div className="drop-sheet-art"><span><Gift size={30} strokeWidth={2.2} /></span><i /><i /><i /></div>
            <input
              className="create-name-input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={createKind === "stall" ? "Stall name" : createKind === "event" ? "Event name" : "Name"}
              aria-label="Name"
            />
            <p className="drop-sheet-copy">
              {createKind === "stall"
                ? "This stall uses the spot you pressed on the map."
                : createKind === "event"
                  ? "This event uses the spot you pressed on the map."
                  : "This uses the spot you pressed on the map."}
            </p>
            <PushButton className="claim-button" disabled={creatingPlace || !createName.trim()} onClick={() => void handleCreatePlace()}>
              {creatingPlace ? <><span className="spinner" /> Creating…</> : `Create ${createKind}`}
            </PushButton>
            {createError && <p className="you-error">{createError}</p>}
          </div>
        </Sheet>
      )}
      {outsidePromptOpen && locationState === "outside" && (
        <div className="outside-overlay" role="dialog" aria-modal="true" aria-labelledby="outside-title">
          <div className="outside-panel">
            <span className="outside-pin"><MapPin size={20} /></span>
            <p className="outside-kicker">DEVCITY 26</p>
            <h2 id="outside-title">You’re outside Mumbai</h2>
            <p>DEVCITY 26 is currently live in Mumbai. You can still look around the city and see what&apos;s happening.</p>
            <PushButton className="outside-cta" onClick={exploreMumbai}>Show Mumbai</PushButton>
            <button className="outside-dismiss" onClick={() => setOutsidePromptOpen(false)}>Stay here</button>
          </div>
        </div>
      )}
      {locationPromptOpen && locationSharing && (locationState === "denied" || locationState === "unavailable" || locationState === "timeout") && (
        <div className="outside-overlay location-overlay" role="dialog" aria-modal="true" aria-labelledby="location-title">
          <div className="outside-panel location-panel">
            <span className="outside-pin"><LocateFixed size={20} /></span>
            <p className="outside-kicker">YOUR LOCATION STAYS PRIVATE</p>
            <h2 id="location-title">{locationState === "denied" ? "Location isn’t on" : locationState === "timeout" ? "Location timed out" : "No position yet"}</h2>
            <p>{locationState === "denied"
              ? "Allow location for this site in your browser settings, then try again. Your exact location stays on your device and is never shown to other people."
              : locationState === "timeout"
                ? "Location is already on. This reading timed out before a position arrived. Try again. Your exact location is never shown to other people."
                : "This device could not find a position. Try again. Your exact location is never shown to other people."}</p>
            <PushButton className="outside-cta" onClick={requestLocation} disabled={requestingLocation}>
              {requestingLocation ? "Checking location…" : "Try location again"}
            </PushButton>
            <button className="outside-dismiss" onClick={exploreMumbai}>Show the Mumbai map</button>
          </div>
        </div>
      )}
      {dropSheetOpen && selected?.kind === "drop" && (
        <Sheet open={dropSheetOpen} onClose={() => { setDropSheetOpen(false); if (window.location.pathname.startsWith("/drop/")) window.history.back(); }} eyebrow={selectedIsTest ? "TEST" : "Live drop"} title={claimView.state === "success" ? "Claimed" : selected.name}>
          <div className="drop-sheet-content">
            <div className="drop-sheet-art"><img src="/assets/original/drop-crate.svg" alt="" width={72} height={72} /><i /><i /><i /></div>
            <p className="drop-sheet-amount">{selected.amount} <span>{tokenFor(selected)}</span></p>
            {selectedIsTest && <p className="prototype-note">TEST drop. This is not real data and nothing can be claimed.</p>}
            <p className={`claim-flow-status is-${claimView.state}`} role={claimView.state === "failed" ? "alert" : "status"}>{claimView.title}</p>
            <p className="drop-sheet-copy">{claimView.detail}</p>
            <div className="drop-sheet-meta"><span><MapPin size={14} /> {claimView.distanceM != null ? claimDistanceSentence(claimView.distanceM) : claimView.title}</span><span><UsersRound size={14} /> {selectedClaimedCount ?? 0} claimed</span></div>
            {claimView.state !== "success" ? (
              <>
                {claimView.state === "location-off" && (
                  <button className="secondary-action claim-location-retry" onClick={() => void toggleLocationSharing()}>
                    <MapPin size={15} /> Turn location on
                  </button>
                )}
                {(claimView.state === "permission-required" || claimView.state === "location-unavailable" || claimView.state === "location-timeout") && (
                  <button className="secondary-action claim-location-retry" onClick={requestLocation} disabled={requestingLocation}>
                    <LocateFixed size={15} /> {requestingLocation ? "Checking location" : "Try location again"}
                  </button>
                )}
                {claimAskPin && !claimUnlocked && (claimView.state === "ready" || claimView.state === "failed") && (
                  <>
                    <label className="wallet-field-label" htmlFor="claim-wallet-pin">Wallet PIN</label>
                    <PinBoxes id="claim-wallet-pin" value={claimPin} onChange={setClaimPin} />
                  </>
                )}
                {!feedUserAddress && claimView.state === "ready" && <p className="you-note">This account has no wallet on this device yet.</p>}
                {(claimView.state === "ready" || claimView.state === "failed") && (
                  <FeePreview quote={claimFee.quote} error={claimFee.error} loading={claimFee.loading} />
                )}
                <PushButton
                  className={`claim-button${claimView.state === "awaiting-signature" ? " is-signing" : ""}`}
                  disabled={selectedIsTest || (feedUserAddress ? (!claimView.canPressClaim || claimSigning || claimLocating || Boolean(claimFee.error)) : claimView.state !== "ready")}
                  onClick={() => { if (selectedIsTest) return; if (!feedUserAddress) { openWallet(); return; } void handleClaim(); }}
                >
                  {claimView.state === "checking-location" && "Checking location"}
                  {claimView.state === "location-off" && "Location is off"}
                  {claimView.state === "permission-required" && "Location permission required"}
                  {claimView.state === "location-unavailable" && "Location unavailable"}
                  {claimView.state === "location-timeout" && "Location timed out"}
                  {claimView.state === "too-far" && "You're too far away"}
                  {claimView.state === "awaiting-signature" && <><span className="spinner" /> Waiting for wallet signature</>}
                  {claimView.state === "failed" && "Claim"}
                  {claimView.state === "ready" && (selectedIsTest ? "TEST only" : feedUserAddress ? "Claim" : "Open wallet")}
                </PushButton>
              </>
            ) : <PushButton className="claim-button is-claimed" onClick={() => setDropSheetOpen(false)}><Check size={15} /> Claimed. Back to the city</PushButton>}
            <p className="prototype-note">Community token · no market value implied</p>
          </div>
        </Sheet>
      )}
      <CreateDropSheet
        open={createDropOpen}
          onClose={() => { setCreateDropOpen(false); setSkipDropLocation(false); }}
        walletAddress={feedUserAddress}
        initialLocation={createDropLocation}
        skipLocation={skipDropLocation}
        notify={setNotice}
        onCreated={handleDropCreated}
        onNeedWallet={openWallet}
      />
    </main>
  );
}
