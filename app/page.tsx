"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { LordIcon } from "@lordicon/react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowUpRight,
  CircleUserRound,
  Gift,
  LocateFixed,
  Map,
  MapPin,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { YouSheet } from "./components/YouSheet";
import { TipSheet, type TipTarget } from "./components/TipSheet";
import { StoryViewer } from "./components/StoryViewer";
import { Sheet } from "./components/Sheet";
import { CitySocialSheet, type SocialView } from "./components/CitySocialSheet";
import { stories } from "./lib/stories";
import { useCityStore } from "./lib/city-store";
import { dicebearAvatarUrl } from "./lib/avatars";

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
  avatar?: string;
};
type FilterKind = "all" | MarkerKind;
type NavTab = "map" | "feed" | "chat" | "wallet" | "people";

const markers: CityMarker[] = [
  { id: "drop-1", kind: "drop", name: "ETHHOUSE DROP", detail: "50 ETHHOUSE · 18 left", distance: "near Gateway", latitude: 18.9221, longitude: 72.8347, color: "lime", amount: "50" },
  { id: "person-1", kind: "person", name: "Genesis", detail: "Looking for the rooftop set", distance: "near Kala Ghoda", latitude: 18.9282, longitude: 72.8314, color: "coral", initials: "G", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=genesis-mumbai&backgroundColor=ff795f" },
  { id: "event-1", kind: "event", name: "Dev meetup", detail: "Talks start at 7:00", distance: "at Fort", latitude: 18.9352, longitude: 72.8371, color: "blue", initials: "D" },
  { id: "place-1", kind: "place", name: "Kala Ghoda", detail: "Art district · cafés and galleries", distance: "Fort district", latitude: 18.9273, longitude: 72.8318, color: "pink", initials: "K" },
  { id: "person-2", kind: "person", name: "Amina", detail: "Just claimed 20 DEV", distance: "near Churchgate", latitude: 18.9326, longitude: 72.8262, color: "yellow", initials: "A", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=amina-mumbai&backgroundColor=ffd75e" },
  { id: "drop-2", kind: "drop", name: "FIRST ROUND", detail: "10 DEV · 6 left", distance: "near Flora Fountain", latitude: 18.9321, longitude: 72.8347, color: "orange", amount: "10" },
  { id: "place-2", kind: "place", name: "Oval Maidan", detail: "Open green · Churchgate", distance: "Churchgate", latitude: 18.9297, longitude: 72.8258, color: "mint", initials: "O" },
];

const MUMBAI_CENTER: [number, number] = [72.833, 18.932];
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [notice, setNotice] = useState("");
  const [youOpen, setYouOpen] = useState(false);
  const [socialView, setSocialView] = useState<SocialView | null>(null);
  const [storyName, setStoryName] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [locationState, setLocationState] = useState<"checking" | "inside" | "outside" | "denied" | "unavailable">("checking");
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [outsidePromptOpen, setOutsidePromptOpen] = useState(false);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);
  const [dropClaimed, setDropClaimed] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3400);
    return () => clearTimeout(timer);
  }, [notice]);

  const noticeRef = useRef(notice);
  useEffect(() => {
    noticeRef.current = notice;
  }, [notice]);

  useEffect(() => {
    const feed = [
      "Amina claimed 20 DEV at The Foundry",
      "Kai went live at the Courtyard stage",
      "Tobi joined the Dev meetup",
      "Mara pinned a table at The Foundry",
      "First Round drop has 6 left",
    ];
    let i = 0;
    const id = setInterval(() => {
      if (noticeRef.current) return;
      const mine = useCityStore.getState().activity[0];
      if (mine && Math.random() < 0.4) {
        setNotice(mine.text);
      } else {
        setNotice(feed[i % feed.length]);
        i += 1;
      }
    }, 7500);
    return () => clearInterval(id);
  }, []);
  const [tipTarget, setTipTarget] = useState<TipTarget | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const { isConnected } = useAccount();
  const claimedMap = useCityStore((s) => s.claimed);
  const claim = useCityStore((s) => s.claim);
  const activity = useCityStore((s) => s.activity);
  const broadcasts = useCityStore((s) => s.broadcasts);
  const addBroadcast = useCityStore((s) => s.addBroadcast);
  const toggleBroadcastLike = useCityStore((s) => s.toggleBroadcastLike);
  const addBroadcastComment = useCityStore((s) => s.addBroadcastComment);
  const avatarMode = useCityStore((s) => s.avatarMode);
  const avatarSeed = useCityStore((s) => s.avatarSeed);
  const avatarImageData = useCityStore((s) => s.avatarImageData);
  const presenceStatus = useCityStore((s) => s.presenceStatus);
  const shuffleAvatar = useCityStore((s) => s.shuffleAvatar);

  useEffect(() => {
    if (!avatarSeed) shuffleAvatar();
  }, [avatarSeed, shuffleAvatar]);

  const visibleMarkers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return markers.filter((marker) => {
      const matchesFilter = filter === "all" || marker.kind === filter;
      const matchesSearch = !normalizedSearch || `${marker.name} ${marker.detail}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [filter, searchTerm]);

  const selected = selectedId
    ? visibleMarkers.find((marker) => marker.id === selectedId) ?? visibleMarkers[0]
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
      center: MUMBAI_CENTER,
      zoom: 14.1,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      const crowdPoints = markers.filter((marker) => marker.kind === 'person').map((marker) => ({
        type: 'Feature' as const,
        properties: { weight: 1 },
        geometry: { type: 'Point' as const, coordinates: [Number(marker.longitude.toFixed(3)), Number(marker.latitude.toFixed(3))] },
      }));
      map.addSource('city-presence-density', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: crowdPoints },
      });
      const firstLabelLayer = map.getStyle().layers?.find((layer) => layer.type === 'symbol' && Boolean(layer.layout?.['text-field']))?.id;
      map.addLayer({
        id: 'city-presence-warmth',
        type: 'heatmap',
        source: 'city-presence-density',
        maxzoom: 17,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.45, 16, 0.9],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 24, 16, 48],
          'heatmap-opacity': 0.42,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(255, 213, 94, 0)', 0.2, 'rgba(255, 213, 94, 0.32)', 0.55, 'rgba(255, 155, 74, 0.48)', 1, 'rgba(255, 121, 95, 0.62)'],
        },
      }, firstLabelLayer);
      for (const marker of markers) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `map-marker marker-${marker.kind} tone-${marker.color}${selectedId === marker.id ? " marker-selected" : ""}`;
        element.setAttribute("aria-label", `${marker.name}, ${marker.distance}`);
        if (marker.kind === "person" && marker.avatar) {
          const avatar = document.createElement("img");
          avatar.src = marker.avatar;
          avatar.alt = "";
          avatar.className = "marker-avatar-image";
          element.append(avatar);
          const live = document.createElement("span");
          live.className = "avatar-live";
          element.append(live);
        } else {
          const icon = document.createElement("span");
          icon.className = "marker-icon-content";
          if (marker.kind === "drop" && marker.amount) {
            icon.innerHTML = `<span class="marker-drop-gift">🎁</span><span class="marker-token">${marker.amount}<small>${marker.id === "drop-1" ? "ETHHOUSE" : "DEV"}</small></span>`;
          } else {
            icon.textContent = marker.kind === "event" ? "🎟️" : marker.kind === "place" ? "📍" : marker.initials ?? "•";
          }
          element.append(icon);
        }
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          setSelectedId(marker.id);
          if (marker.kind === "drop") {
            setDropClaimed(Boolean(claimedMap[marker.id]));
            setDropSheetOpen(true);
          }
        });
        const publicPosition = marker.kind === "person"
          ? [Number(marker.longitude.toFixed(3)), Number(marker.latitude.toFixed(3))] as [number, number]
          : [marker.longitude, marker.latitude] as [number, number];
        const mapMarker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(publicPosition)
          .addTo(map);
        mapMarkersRef.current.set(marker.id, mapMarker);
      }
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
    if (mapReady || mapError) {
      const timer = window.setTimeout(() => setShowIntro(false), mapReady ? 420 : 1200);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setShowIntro(false);
      setMapError(true);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [mapError, mapReady]);

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
      const visible = filter === "all" || markers.find((item) => item.id === id)?.kind === filter;
      marker.getElement().classList.toggle("marker-filtered-out", !visible);
      marker.getElement().classList.toggle("marker-selected", selected?.id === id);
    });
    if (mapReady && mapRef.current?.getLayer('city-presence-warmth')) {
      mapRef.current.setLayoutProperty('city-presence-warmth', 'visibility', filter === 'all' || filter === 'person' ? 'visible' : 'none');
    }
    if (selected && mapReady) {
      mapRef.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 15, duration: 650 });
    }
  }, [filter, mapReady, selected]);

  useEffect(() => {
    if (!mapReady || !myPosition) return;
    const element = document.createElement("div");
    element.className = `my-location-marker${broadcasts.length > 0 && presenceStatus !== 'offline' ? ' my-location-broadcasting' : ''}${presenceStatus === 'offline' ? ' my-location-offline' : ''}`;
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
  }, [avatarImageData, avatarMode, avatarSeed, broadcasts.length, mapReady, myPosition, presenceStatus]);

  function tokenFor(marker: CityMarker) {
    return marker.id === "drop-1" ? "ETHHOUSE" : "DEV";
  }

  function handleClaim() {
    if (!selected || selected.kind !== "drop") return;
    if (!isConnected) {
      setYouOpen(true);
      setNotice("Connect a wallet to claim.");
      return;
    }
    setClaiming(true);
    setTimeout(() => {
      claim(selected.id, selected.name, tokenFor(selected), selected.amount ?? "1");
      setClaiming(false);
      setDropClaimed(true);
      setNotice(`Claimed ${selected.amount} ${tokenFor(selected)} — added to your tokens.`);
    }, 900);
  }

  function chooseTab(tab: NavTab) {
    setActiveTab(tab);
    setNotice("");
    setSocialView(null);
    if (tab === "map") setFilter("all");
    if (tab === "feed" || tab === "chat" || tab === "people") setSocialView(tab);
    if (tab === "wallet") setYouOpen(true);
  }

  function chooseFilter(nextFilter: FilterKind) {
    setFilter(nextFilter);
    const firstVisible = markers.find((marker) => nextFilter === "all" || marker.kind === nextFilter);
    if (firstVisible) setSelectedId(firstVisible.id);
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

  function openProfile() {
    setSocialView(null);
    setActiveTab("map");
    setYouOpen(true);
  }

  function handleBroadcast(text: string) {
    addBroadcast(text);
    setNotice('Broadcast added to your city feed. Your map signal grew.');
  }

  function notifyChat(message: string) {
    setNotice(message);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('DEVCITY26', { body: message, icon: '/devcity-mark.svg' });
    }
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
        {showIntro && <div className={`city-intro${mapReady ? " is-leaving" : ""}`} aria-live="polite">
          <Image className="city-loader-art" src="/devcity-mark.svg" alt="DEVCITY26" width={104} height={104} priority unoptimized />
          <strong>DEVCITY26</strong>
          <span className="intro-beta">[BETA]</span>
          <span className="intro-edition">MUMBAI EDITION</span>
          <span className="intro-loading">{mapReady ? "CITY READY" : mapError ? "CITY MAP IS SLOW" : "LOADING CITY"}<i /><i /><i /></span>
        </div>}
        {mapError && <div className="map-load-notice" role="status">
          <span>{mapReady ? "Some map details are taking a moment." : "The map is taking a moment to arrive."}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>}

        <header className="topbar">
          <div className="location-heading">
            <span className="eyebrow"><span className="live-dot" /> MUMBAI IS LIVE</span>
            <h1>Fort, Mumbai <span>⌄</span></h1>
            <p>South Mumbai <b>·</b> 286 in the city</p>
          </div>
          <div className="top-actions">
            {searchOpen && <label className="search-field"><Search size={16} /><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find a person or place" /><button onClick={() => { setSearchOpen(false); setSearchTerm(""); }} aria-label="Close search"><X size={16} /></button></label>}
            <button className="round-action" onClick={() => setSearchOpen((open) => !open)} aria-label={searchOpen ? "Close search" : "Search the city"}><Search size={18} /></button>
            <button className="invite-button" onClick={() => setNotice("Your invite link is ready to share.")}><Plus size={15} /> Invite</button>
            <button className={`top-profile-button${youOpen ? " is-active" : ""}`} onClick={openProfile} aria-label="Open your profile" title="Your profile"><CircleUserRound size={19} /></button>
          </div>
        </header>

        <div className="map-tools">
          <div className="filter-list" role="group" aria-label="Filter map">
            {filters.map((item) => <button key={item.id} className={`filter-chip ${filter === item.id ? "is-selected" : ""}`} onClick={() => chooseFilter(item.id)}>{item.label}</button>)}
          </div>
          <button className="locate-button" onClick={centerOnMe} aria-label="Center map on me" title="Center map"><LocateFixed size={18} /></button>
        </div>

        {selected && <article className={`activity-card ${selected.kind === "drop" ? "drop-card" : ""}`} aria-live="polite">
          <div className="card-topline">
            <span className={`card-icon tone-${selected.color}`}><MarkerIcon kind={selected.kind} size={17} /></span>
            <span className="card-kind">{selected.kind === "drop" ? "TOKEN DROP" : selected.kind.toUpperCase()}</span>
            <button className="card-more" onClick={() => setNotice(`${selected.name} · ${selected.distance} away`)} aria-label="More details"><ArrowUpRight size={17} /></button>
          </div>
          <h2>{selected.name}</h2>
          <p className="card-description">{selected.detail}</p>
          <div className="card-meta"><span><MapPin size={13} /> {selected.distance}</span>{selected.kind === "drop" && <span className="claim-count">18 people claimed</span>}</div>
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
          ) : (
            <button className="secondary-action" onClick={() => setNotice(`Opening ${selected.name}`)}>
              See what&apos;s happening <ArrowUpRight size={15} />
            </button>
          )}
          <p className="prototype-note">{connected ? "Ready when you are" : "Join the city to claim and tip"}</p>
        </article>}

        {notice && <div className="notice-toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}

        <nav className="mobile-nav" aria-label="Main navigation">
          <button className={activeTab === "map" ? "is-active" : ""} onClick={() => chooseTab("map")} aria-label="Map"><Map size={19} /><span>Map</span></button>
          <button className={activeTab === "feed" ? "is-active" : ""} onClick={() => chooseTab("feed")} aria-label="Feed"><Radio size={19} /><span>Feed</span></button>
          <button className={activeTab === "chat" ? "is-active" : ""} onClick={() => chooseTab("chat")} aria-label="Chat"><MessageCircle size={19} /><span>Chat</span></button>
          <button className={activeTab === "people" ? "is-active" : ""} onClick={() => chooseTab("people")} aria-label="People"><UsersRound size={19} /><span>People</span></button>
          <button className={activeTab === "wallet" ? "is-active" : ""} onClick={() => chooseTab("wallet")} aria-label="Wallet"><LordIcon className="wallet-tab-lordicon" src="/icons/wallet.json" trigger="hover" target="button"><img src="/icons/wallet.svg" alt="" /></LordIcon><span>Wallet</span></button>
        </nav>
      </section>

      <StoryViewer key={storyName ?? "none"} story={storyName ? stories[storyName] ?? null : null} onClose={() => setStoryName(null)} />
      <YouSheet open={youOpen} onClose={() => { setYouOpen(false); if (activeTab === "wallet") setActiveTab("map"); }} notify={setNotice} />
      <CitySocialSheet
        open={socialView !== null}
        view={socialView}
        activity={activity}
        broadcasts={broadcasts}
        avatarSrc={currentAvatarSrc}
        onBroadcast={handleBroadcast}
        onLikeBroadcast={toggleBroadcastLike}
        onCommentBroadcast={addBroadcastComment}
        onNotify={notifyChat}
        onConnectWallet={() => { setSocialView(null); setActiveTab('wallet'); setYouOpen(true); }}
        onEnableNotifications={() => void enableChatNotifications()}
        notificationsEnabled={typeof Notification !== 'undefined' && Notification.permission === 'granted'}
        onClose={() => { setSocialView(null); setActiveTab("map"); }}
        onTip={(name, initials, color) => { setSocialView(null); setTipTarget({ name, initials, color }); }}
      />
      <TipSheet
        open={tipTarget !== null}
        onClose={() => setTipTarget(null)}
        target={tipTarget}
        isConnected={isConnected}
        onNeedWallet={() => setYouOpen(true)}
        notify={setNotice}
      />
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
        <Sheet open={dropSheetOpen} onClose={() => setDropSheetOpen(false)} eyebrow="Mumbai · live drop" title={dropClaimed ? "✨ Claimed" : selected.name}>
          <div className="drop-sheet-content">
            <div className="drop-sheet-art"><span>🎁</span><i /><i /><i /></div>
            <p className="drop-sheet-amount">{selected.amount} <span>{tokenFor(selected)}</span></p>
            <p className="drop-sheet-copy">{dropClaimed ? "Your tokens are in your city stash. Keep exploring Mumbai." : "A little something from the community, waiting near Gateway of India."}</p>
            <div className="drop-sheet-meta"><span><MapPin size={14} /> Gateway of India</span><span><UsersRound size={14} /> 18 claimed · 6 left</span></div>
            {!dropClaimed ? <button className="claim-button" disabled={claiming} onClick={handleClaim}>{claiming ? <><span className="spinner" /> Claiming…</> : <>Claim {selected.amount} {tokenFor(selected)}<ArrowUpRight size={16} /></>}</button> : <button className="claim-button is-claimed" onClick={() => setDropSheetOpen(false)}>✨ Claimed · Back to city</button>}
            <p className="prototype-note">Community token · no market value implied</p>
          </div>
        </Sheet>
      )}
    </main>
  );
}
