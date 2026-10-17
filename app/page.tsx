"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowUpRight,
  Gift,
  LocateFixed,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { eventMarkerSvg } from "./components/EventMapMarker";
import { EventCard } from "./components/EventCard";
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
import { GameIcon } from "./components/game/GameIcons";
import { HudBar } from "./components/game/HudBar";
import { BuildingSprite } from "./components/game/Buildings";
import { useGameStore } from "./lib/game-store";
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
type NavTab = "map" | "feed" | "chat" | "wallet" | "people";

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

function isEventLive(event: EventApiItem): boolean {
  const start = event.startDate
    ? new Date(`${event.startDate}T${event.startTime || "00:00:00"}Z`).getTime()
    : Date.now();
  const end = event.endDate
    ? new Date(`${event.endDate}T${event.endTime || "23:59:59"}Z`).getTime()
    : start + 24 * 3600 * 1000;
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const now = Date.now();
  return now >= start && now <= end;
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
    : [dateLabel, event.startTime].filter(Boolean).join(" · ") || "Devcon week event";
  return {
    id: `event-${event.slug}`,
    kind: "event",
    name: event.name,
    detail,
    distance: event.location?.trim() || "Mumbai",
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
    detail: drop.description?.trim() || `${drop.amount} ${token} · live drop`,
    distance: "Mumbai",
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

function MarkerIcon({ kind, size = 16 }: { kind: MarkerKind; size?: number }) {
  if (kind === "drop") return <Gift size={size} strokeWidth={2.4} />;
  if (kind === "person") return <UsersRound size={size} strokeWidth={2.2} />;
  if (kind === "event") return <Sparkles size={size} strokeWidth={2.2} />;
  return <MapPin size={size} strokeWidth={2.2} />;
}

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
  const [locationState, setLocationState] = useState<"checking" | "inside" | "outside" | "denied" | "unavailable">("checking");
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [outsidePromptOpen, setOutsidePromptOpen] = useState(false);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"stall" | "booth" | null>(null);
  const [createName, setCreateName] = useState("");
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [createError, setCreateError] = useState("");
  const [dropClaimed, setDropClaimed] = useState(false);
  const [eventMarkers, setEventMarkers] = useState<CityMarker[]>([]);
  const [dropMarkers, setDropMarkers] = useState<CityMarker[]>([]);
  const [cityCount, setCityCount] = useState(0);
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
  const gameStreak = useGameStore((s) => s.streak);
  useEffect(() => {
    if (feedUserAddress) void loadGame(feedUserAddress);
  }, [feedUserAddress, loadGame]);

  const refreshFeedProfile = useCallback(async () => {
    setFeedProfileStatus("checking");
    setFeedUserAddress(null);
    try {
      const [{ authClient }, { listLocalWallets }] = await Promise.all([
        import("@/lib/auth-client"),
        import("@/lib/keystore"),
      ]);
      const session = await authClient.getSession();
      const user = (session?.data as { user?: { id: string } } | null)?.user;
      if (!user) {
        setFeedProfileStatus("signed-out");
        return;
      }
      const wallets = await listLocalWallets();
      const address = wallets[0]?.address ?? null;
      setFeedUserAddress(address);
      setFeedProfileStatus(address ? "ready" : "wallet-needed");
    } catch {
      setFeedProfileStatus("error");
    }
  }, []);

  useEffect(() => {
    void refreshFeedProfile();
  }, [refreshFeedProfile]);

  useEffect(() => setHydrated(true), []);

  const { isConnected } = useAccount();
  const claimedMap = useCityStore((s) => s.claimed);
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

  const allMarkers = useMemo(() => [...dropMarkers, ...eventMarkers], [dropMarkers, eventMarkers]);
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
  const isClaimed = hydrated && selected ? Boolean(claimedMap[selected.id]) : false;
  const connected = hydrated && isConnected;

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
    map.on("click", (event) => onMapTapRef.current(event.lngLat.lng, event.lngLat.lat));
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
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { events?: EventApiItem[] } | null) => {
        if (cancelled || !data?.events) return;
        const mapped = data.events
          .map(eventToMarker)
          .filter((item): item is CityMarker => item !== null);
        setEventMarkers(mapped);
      })
      .catch(() => {});
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
      .then((data: { users?: unknown[] } | null) => {
        if (!cancelled && data?.users) setCityCount(data.users.length);
      })
      .catch(() => {});
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
      const isLive = marker.raw ? isEventLive(marker.raw) : false;
      element.className = `map-marker event-pin-marker${isLive ? " is-live" : ""}`;
      element.setAttribute("aria-label", `${marker.name}, ${marker.distance}`);
      element.innerHTML = eventMarkerSvg({ title: marker.name, category: marker.category });
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: "bottom" })
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
      element.className = `map-marker marker-drop tone-${marker.color}${claimedMap[marker.id] ? " is-claimed" : ""}`;
      element.setAttribute("aria-label", `${marker.name}, ${marker.detail}`);
      const icon = document.createElement("span");
      icon.className = "marker-icon-content";
      icon.innerHTML = `<span class="marker-drop-crate"><svg width="30" height="30" viewBox="0 0 120 120" fill="none" aria-hidden="true"><g stroke="#1c2925" stroke-width="3" stroke-linejoin="round"><path d="M30 52 60 36l30 16-30 16-30-16Z" fill="#ffb35c"/><path d="M30 52v20l30 16V68L30 52Z" fill="#e28a2a"/><path d="M90 52v20L60 88V68l30-16Z" fill="#f4a03e"/><path d="M60 36v32" fill="none"/></g><g stroke="#1c2925" stroke-width="3" stroke-linejoin="round"><path d="M60 48v20" stroke="#ffe27a"/><path d="M60 58l-12 6m12-6 12 6" stroke="#ffe27a"/></g></svg></span><span class="marker-token">${marker.amount}<small>${marker.tokenSymbol}</small></span>`;
      element.append(icon);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedId(marker.id);
        setCardClosed(false);
        setDropClaimed(Boolean(claimedMap[marker.id]));
        setDropSheetOpen(true);
      });
      const mapMarker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
      registry.set(marker.id, mapMarker);
    }
  }, [dropMarkers, mapReady, claimedMap]);

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
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      setLocationPromptOpen(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude];
        setMyPosition(position);
        if (isInsideMumbai(position[0], position[1])) {
          setLocationState("inside");
          mapRef.current?.flyTo({ center: position, zoom: 15, duration: 1100 });
        } else {
          setLocationState("outside");
          setOutsidePromptOpen(true);
        }
      },
      (error) => {
        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        setLocationPromptOpen(true);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    mapMarkersRef.current.forEach((marker, id) => {
      const visible = filter === "all" || kindById.get(id) === filter;
      marker.getElement().classList.toggle("marker-filtered-out", !visible);
      marker.getElement().classList.toggle("marker-selected", selected?.id === id);
    });
    if (selected && mapReady) {
      mapRef.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 15, duration: 650 });
    }
  }, [filter, kindById, mapReady, selected]);

  useEffect(() => {
    if (!mapReady || !myPosition) return;
    const element = document.createElement("div");
    element.className = `my-location-marker${presenceStatus === 'offline' ? ' my-location-offline' : ''}`;
    if (avatarMode === 'upload' && avatarImageData) {
      const avatar = document.createElement('img');
      avatar.src = avatarImageData;
      avatar.alt = '';
      element.append(avatar);
    } else if (avatarMode === 'dicebear' && avatarSeed) {
      const avatar = document.createElement('img');
      avatar.src = dicebearAvatarUrl(avatarSeed);
      avatar.alt = '';
      element.append(avatar);
    } else {
      element.textContent = 'YOU';
    }
    if (presenceStatus !== 'offline') {
      const status = document.createElement('i');
      status.className = `my-location-status status-${presenceStatus}`;
      element.append(status);
    }
    const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(myPosition).addTo(mapRef.current!);
    return () => {
      marker.remove();
    };
  }, [avatarImageData, avatarMode, avatarSeed, mapReady, myPosition, presenceStatus]);

  function tokenFor(marker: CityMarker) {
    return marker.tokenSymbol ?? "TOKENS";
  }

  async function handleClaim() {
    if (!selected || selected.kind !== "drop") return;
    const self = await import("@/lib/keystore");
    const local = await self.listLocalWallets();
    const myAddress = local[0]?.address;
    if (!myAddress) {
      openWallet();
      setNotice("Create a passkey wallet to claim.");
      return;
    }
    setClaiming(true);
    try {
      const response = await fetch("/api/claims/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropId: selected.id.replace(/^drop-/, ""), userAddress: myAddress }),
      });
      if (!response.ok) throw new Error("Claim could not be authorized.");
      claim(selected.id, selected.name, tokenFor(selected), selected.amount ?? "1");
      setDropClaimed(true);
      setNotice(`Claimed ${selected.amount} ${tokenFor(selected)} — added to your tokens.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Claim failed. Try again.");
    } finally {
      setClaiming(false);
    }
  }

  async function handleCreatePlace() {
    if (!createKind || !createName.trim()) return;
    setCreatingPlace(true);
    setCreateError("");
    try {
      const self = await import("@/lib/keystore");
      const local = await self.listLocalWallets();
      const ownerId = local[0]?.address;
      if (!ownerId) {
        openWallet();
        setCreateError("Create a passkey wallet first to set up a spot.");
        return;
      }
      const endpoint = createKind === "stall" ? "/api/stalls" : "/api/booths";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          name: createName.trim(),
          lat: myPosition?.[0] ?? 19.0662,
          lng: myPosition?.[1] ?? 72.8697,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create.");
      setNotice(`${createKind === "stall" ? "Stall" : "Booth"} "${createName.trim()}" created.`);
      setCreateKind(null);
      setCreateName("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create. Try again.");
    } finally {
      setCreatingPlace(false);
    }
  }

  function chooseTab(tab: NavTab) {
    setActiveTab(tab);
    setNotice("");
    setSocialView(null);
    setScanOpen(false);
    if (tab === "map") setFilter("all");
    if (tab === "feed" || tab === "chat" || tab === "people") setSocialView(tab);
    if (tab === "wallet") {
      setYouOpen(false);
      setWalletOpen(true);
    }
  }

  function chooseFilter(nextFilter: FilterKind) {
    if (nextFilter === "person") {
      setSocialView("people");
      setActiveTab("map");
      return;
    }
    setFilter(nextFilter);
    setCardClosed(false);
    setSelectedId(null);
  }

  function exploreMumbai() {
    setOutsidePromptOpen(false);
    setLocationPromptOpen(false);
    mapRef.current?.flyTo({ center: MUMBAI_CENTER, zoom: 14.1, duration: 1100 });
  }

  function requestLocation() {
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
        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        setLocationPromptOpen(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }

  function centerOnMe() {
    if (myPosition && locationState === "inside") {
      mapRef.current?.flyTo({ center: myPosition, zoom: 15, duration: 850 });
    } else if (locationState === "outside") {
      setOutsidePromptOpen(true);
    } else {
      setNotice("Your location is unavailable. Exploring Mumbai instead.");
      mapRef.current?.flyTo({ center: MUMBAI_CENTER, zoom: 14.1, duration: 850 });
    }
  }

  const openCreateDrop = useCallback((location?: { lat: number; lng: number } | null) => {
    setCreateMenuOpen(false);
    setCityMenuOpen(false);
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
      setCreateDropLocation({ lat, lng });
      setCreateDropOpen(true);
    };
  }, [feedUserAddress]);

  function handleDropCreated() {
    void refreshDrops();
  }

  function openProfile() {
    setReturnToFeedAfterProfile(false);
    setSocialView(null);
    setActiveTab("map");
    setWalletOpen(false);
    setYouOpen(true);
  }

  function openWallet() {
    setSocialView(null);
    setScanOpen(false);
    setYouOpen(false);
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
      <section className="city-stage" id="city" aria-label="Live Mumbai city map">
        <div ref={mapContainer} className="real-city-map" aria-label="Map of Mumbai with city activity" />
        <div className="map-tint vignette" aria-hidden="true" />
        {showIntro && <div className={`city-intro${mapReady ? " is-leaving" : ""}`} aria-live="polite">
          <Image className="city-loader-art" src="/assets/loading.svg" alt="DEVCITY26" width={104} height={104} priority unoptimized />
          <strong>DEVCITY26</strong>
          <span className="intro-beta">[BETA]</span>
          <span className="intro-edition">MUMBAI EDITION</span>
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
        {!dropLoading && !dropError && dropMarkers.length === 0 && (
          <div className="map-drops-status" role="status">No live drops yet — tap the map to create one.</div>
        )}

        <header className="topbar">
          <div className="location-heading">
            <span className="eyebrow"><span className="live-dot" /> MUMBAI IS LIVE</span>
            <h1>Fort, Mumbai <span>⌄</span></h1>
            <p>South Mumbai{cityCount > 0 && <> <b>·</b> {cityCount} in the city</>}</p>
          </div>
          <div className="top-actions">
            <div className="hudbar-slot"><HudBar streak={gameStreak} /></div>
            <button className="round-action" onClick={() => setSearchSheetOpen(true)} aria-label="Search the city"><Search size={18} /></button>
            <button className="round-action" onClick={() => { setCityMenuOpen((v) => !v); }} aria-label="City hub" title="City hub">
              <GameIcon name="spark" size={20} />
            </button>
            <button className="notification-bell round-action" onClick={() => setNotificationsOpen(true)} aria-label="Notifications" title="Notifications">
              <GameIcon name="inbox" size={20} />
            </button>
            <button className="invite-button" onClick={() => setNotice("Your invite link is ready to share.")}><Plus size={15} /> Invite</button>
            <button className={`top-profile-button${youOpen ? " is-active" : ""}`} onClick={openProfile} aria-label="Open your profile" title="Your profile">
              <img src={currentAvatarSrc ?? dicebearAvatarUrl(avatarSeed || "devcity26")} alt="" />
            </button>
          </div>
        </header>

        <div className="map-tools">
          <div className="filter-list" role="group" aria-label="Filter map">
            {filters.map((item) => <button key={item.id} className={`filter-chip ${filter === item.id || (item.id === "person" && socialView === "people") ? "is-selected" : ""}`} onClick={() => chooseFilter(item.id)}>{item.label}</button>)}
          </div>
          <button className="locate-button" onClick={centerOnMe} aria-label="Center map on me" title="Center map"><LocateFixed size={18} /></button>
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
                <button className="create-menu-item" role="menuitem" onClick={() => { setCityMenuOpen(false); setTrendingOpen(true); }}><Sparkles size={16} /> Trending</button>
                <button className="create-menu-item" role="menuitem" onClick={() => { setCityMenuOpen(false); setLeaderboardOpen(true); }}><Sparkles size={16} /> Leaderboard</button>
                <button className="create-menu-item" role="menuitem" onClick={() => { setCityMenuOpen(false); setSuggestedOpen(true); }}><UsersRound size={16} /> Who to follow</button>
              </>
            )}
          </div>
        )}

        {selected && (selected.kind === "event" && selected.raw ? (
          <EventCard
            event={selected.raw}
            onClose={() => setCardClosed(true)}
            onShowOnMap={() => mapRef.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 15.5, duration: 900 })}
            attendance={savedEvents.find((event) => event.id === selected.raw?.id)?.attendance ?? null}
            onToggleGoing={() => {
              const event = selected.raw;
              if (!event) return;
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
            <button className="card-more" onClick={() => setNotice(`${selected.name} · ${selected.distance} away`)} aria-label="More details"><ArrowUpRight size={17} /></button>
            <button className="card-close" onClick={() => setCardClosed(true)} aria-label="Close details"><X size={17} /></button>
          </div>
          <h2>{selected.name}</h2>
          <p className="card-description">{selected.detail}</p>
          <div className="card-meta"><span><MapPin size={13} /> {selected.distance}</span>{selected.kind === "drop" && typeof selected.claimedCount === "number" && <span className="claim-count">{selected.claimedCount} claimed</span>}</div>
          {selected.kind === "drop" ? (
            <button
              className={`claim-button ${isClaimed ? "is-claimed" : ""}`}
              onClick={() => { setDropClaimed(isClaimed); setDropSheetOpen(true); }}
              disabled={isClaimed || claiming}
            >
              {isClaimed ? "Added to your tokens" : <>Explore drop <ArrowUpRight size={16} /></>}
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
                <Sparkles size={15} /> Tip
              </button>
              <button className="secondary-action" onClick={() => { setActiveTab('chat'); setSocialView('chat'); }}>
                <MessageCircle size={15} /> Say hello
              </button>
            </div>
          ) : selected.kind === "event" && selected.url ? (
            <a className="secondary-action" href={selected.url} target="_blank" rel="noreferrer">
              View event <ArrowUpRight size={15} />
            </a>
          ) : (
            <button className="secondary-action" onClick={() => setNotice(`Opening ${selected.name}`)}>
              See what&apos;s happening <ArrowUpRight size={15} />
            </button>
          )}
          <p className="prototype-note">{connected ? "Ready when you are" : "Join the city to claim and tip"}</p>
        </article>))}

        {notice && <div className="notice-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}

        <nav className="mobile-nav" aria-label="Main navigation">
          <button className={activeTab === "map" ? "is-active" : ""} onClick={() => chooseTab("map")} aria-label="Map"><GameIcon name="map" /><span>Map</span></button>
          <button className={activeTab === "feed" ? "is-active" : ""} onClick={() => chooseTab("feed")} aria-label="Feed"><GameIcon name="feed" /><span>Feed</span></button>
          <button className="mobile-scan-button" onClick={() => { setSocialView(null); setScanOpen(true); }} aria-label="Scan a QR code"><GameIcon name="scan" /><span>Scan</span></button>
          <button className={activeTab === "chat" ? "is-active" : ""} onClick={() => chooseTab("chat")} aria-label="Inbox"><GameIcon name="inbox" /><span>Inbox</span></button>
          <button className={activeTab === "wallet" ? "is-active" : ""} onClick={() => chooseTab("wallet")} aria-label="Wallet"><GameIcon name="vault" /><span>Wallet</span></button>
        </nav>
      </section>

      <YouSheet open={youOpen} onClose={closeProfile} onOpenWallet={openWallet} />
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
        onTip={(target) => { setScanOpen(false); setTipTarget(target); }}
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
        onTip={(name, initials, color, address) => { setSocialView(null); setTipTarget({ name, initials, color, address }); }}
        startChatAddress={startChatAddress}
        onOpenStory={setActiveStory}
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
      {createKind && (
        <Sheet
          open
          onClose={() => { setCreateKind(null); setCreateName(""); }}
          eyebrow="Mumbai · create"
          title={createKind === "stall" ? "Create a stall" : "Create a booth"}
        >
          <div className="drop-sheet-content">
            <div className="drop-sheet-art"><span><Gift size={30} strokeWidth={2.2} /></span><i /><i /><i /></div>
            <input
              className="create-name-input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={createKind === "stall" ? "Stall name (e.g. Spice corner)" : "Booth name (e.g. Devcon welcome desk)"}
              aria-label="Name"
            />
            <p className="drop-sheet-copy">
              {createKind === "stall"
                ? "A stall is your map-anchored spot in the city. Set it at your current location and share it with people nearby."
                : "A booth is a sponsored/venue space that can host drops and link to an event."}
            </p>
            <button className="claim-button" disabled={creatingPlace || !createName.trim()} onClick={() => void handleCreatePlace()}>
              {creatingPlace ? <><span className="spinner" /> Creating…</> : `Create ${createKind}`}
            </button>
            {createError && <p className="you-error">{createError}</p>}
          </div>
        </Sheet>
      )}
      {outsidePromptOpen && locationState === "outside" && (
        <div className="outside-overlay" role="dialog" aria-modal="true" aria-labelledby="outside-title">
          <div className="outside-panel">
            <span className="outside-pin"><MapPin size={20} /></span>
            <p className="outside-kicker">DEVCITY26 · MUMBAI EDITION</p>
            <h2 id="outside-title">YOU&apos;RE OUTSIDE MUMBAI</h2>
            <p>DEVCITY26 is currently live in Mumbai. You can still explore the city and see what&apos;s happening.</p>
            <button className="outside-cta" onClick={exploreMumbai}>Explore Mumbai <ArrowUpRight size={17} /></button>
            <button className="outside-dismiss" onClick={() => setOutsidePromptOpen(false)}>Stay here</button>
          </div>
        </div>
      )}
      {locationPromptOpen && (locationState === "denied" || locationState === "unavailable") && (
        <div className="outside-overlay location-overlay" role="dialog" aria-modal="true" aria-labelledby="location-title">
          <div className="outside-panel location-panel">
            <span className="outside-pin"><LocateFixed size={20} /></span>
            <p className="outside-kicker">YOUR LOCATION STAYS PRIVATE</p>
            <h2 id="location-title">{locationState === "denied" ? "LOCATION NOT GRANTED" : "LOCATION UNAVAILABLE"}</h2>
            <p>{locationState === "denied"
              ? "Allow location for this site in your browser settings, then try again. Your exact location stays on your device and is never shown to other people."
              : "Your browser couldn't find your location. Check that location services are on and try again. Your exact location is never shown to other people."}</p>
            <button className="outside-cta" onClick={requestLocation} disabled={requestingLocation}>
              {requestingLocation ? "Checking permission…" : locationState === "denied" ? "Try location again" : "Enable location"}<LocateFixed size={17} />
            </button>
            <button className="outside-dismiss" onClick={exploreMumbai}>Explore Mumbai without location</button>
          </div>
        </div>
      )}
      {dropSheetOpen && selected?.kind === "drop" && (
        <Sheet open={dropSheetOpen} onClose={() => setDropSheetOpen(false)} eyebrow="Mumbai · live drop" title={dropClaimed ? "Claimed" : selected.name}>
          <div className="drop-sheet-content">
            <div className="drop-sheet-art"><span><Gift size={30} strokeWidth={2.2} /></span><i /><i /><i /></div>
            <p className="drop-sheet-amount">{selected.amount} <span>{tokenFor(selected)}</span></p>
            <p className="drop-sheet-copy">{dropClaimed ? "Your tokens are in your city stash. Keep exploring Mumbai." : selected.detail}</p>
            <div className="drop-sheet-meta"><span><MapPin size={14} /> {selected.distance}</span><span><UsersRound size={14} /> {selected.claimedCount ?? 0} claimed</span></div>
            {!dropClaimed ? <button className="claim-button" disabled={claiming} onClick={() => void handleClaim()}>{claiming ? <><span className="spinner" /> Claiming…</> : <>Claim {selected.amount} {tokenFor(selected)}<ArrowUpRight size={16} /></>}</button> : <button className="claim-button is-claimed" onClick={() => setDropSheetOpen(false)}><Sparkles size={15} /> Claimed · Back to city</button>}
            <p className="prototype-note">Community token · no market value implied</p>
          </div>
        </Sheet>
      )}
      <CreateDropSheet
        open={createDropOpen}
        onClose={() => setCreateDropOpen(false)}
        walletAddress={feedUserAddress}
        initialLocation={createDropLocation}
        notify={setNotice}
        onCreated={handleDropCreated}
        onNeedWallet={openWallet}
      />
    </main>
  );
}
