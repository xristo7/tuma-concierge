"use client";

import { Loader2, LocateFixed, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadScript, loadStylesheet } from "../../lib/load-script";
import type { MapPickerProps } from "./map-types";

const KAMPALA: [number, number] = [32.5825, 0.3476]; // Mapbox is [lng, lat]
const MAPBOX_GL_VERSION = "3.7.0";

// Minimal shape of the bits of Mapbox GL JS this component touches —
// avoids a full @types/mapbox-gl dependency for a handful of calls.
type MapboxNamespace = {
  accessToken: string;
  Map: new (opts: Record<string, unknown>) => MapboxMap;
  Marker: new (opts?: Record<string, unknown>) => MapboxMarker;
  NavigationControl: new () => unknown;
};
type MapboxMap = {
  on: (event: string, handler: (e: { lngLat: { lng: number; lat: number } }) => void) => void;
  addControl: (control: unknown) => void;
  flyTo: (opts: { center: [number, number] }) => void;
  remove: () => void;
};
type MapboxMarker = { setLngLat: (pos: [number, number]) => MapboxMarker; addTo: (map: MapboxMap) => MapboxMarker; remove: () => void };

declare global {
  interface Window {
    mapboxgl?: MapboxNamespace;
  }
}

type MapboxFeature = { place_name: string; center: [number, number]; context?: { id: string; text: string }[] };

function pickArea(feature: MapboxFeature): string | null {
  const ctx = feature.context ?? [];
  const byPrefix = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text;
  return byPrefix("neighborhood") || byPrefix("locality") || byPrefix("place") || null;
}

async function searchPlace(query: string, accessToken: string): Promise<MapboxFeature[]> {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&country=ug&limit=5`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { features: MapboxFeature[] };
  return data.features ?? [];
}

async function reverseGeocode(lng: number, lat: number, accessToken: string): Promise<{ area: string | null; address: string | null }> {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}`,
  );
  if (!res.ok) return { area: null, address: null };
  const data = (await res.json()) as { features: MapboxFeature[] };
  const first = data.features?.[0];
  return { area: first ? pickArea(first) : null, address: first?.place_name ?? null };
}

/** Mapbox GL JS + Mapbox Geocoding API — mounted only once an admin has
 * saved a working access token and switched to this provider (see
 * ../LocationMapPicker.tsx). Same visual shell and confirm/cancel
 * contract as StreetMapsPicker, so switching providers is invisible to
 * the rest of the app. */
export function MapboxMapPicker({ initial, onConfirm, onCancel, accessToken }: MapPickerProps & { accessToken: string }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [resolving, setResolving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStylesheet(`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`, "tuma-mapbox-css");
    loadScript(`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`, "tuma-mapbox-js")
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapDivRef.current || !window.mapboxgl) return;
    const mapboxgl = window.mapboxgl;
    mapboxgl.accessToken = accessToken;
    const start: [number, number] = initial ? [initial.lng, initial.lat] : KAMPALA;
    const map = new mapboxgl.Map({
      container: mapDivRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: start,
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    if (initial) {
      markerRef.current = new mapboxgl.Marker({ color: "#C9A227" }).setLngLat([initial.lng, initial.lat]).addTo(map);
    }

    map.on("click", (e) => placeMarker(e.lngLat.lat, e.lngLat.lng));

    function placeMarker(lat: number, lng: number) {
      setMarker({ lat, lng });
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else if (window.mapboxgl) {
        markerRef.current = new window.mapboxgl.Marker({ color: "#C9A227" }).setLngLat([lng, lat]).addTo(map);
      }
    }

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function place(lat: number, lng: number) {
    setMarker({ lat, lng });
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else if (window.mapboxgl && mapRef.current) {
      markerRef.current = new window.mapboxgl.Marker({ color: "#C9A227" }).setLngLat([lng, lat]).addTo(mapRef.current);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      mapRef.current?.flyTo({ center: [lng, lat] });
      place(lat, lng);
    });
  }

  function onSearchChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlace(value, accessToken).catch(() => []);
      setResults(found);
      setSearching(false);
    }, 500);
  }

  function chooseResult(f: MapboxFeature) {
    const [lng, lat] = f.center;
    mapRef.current?.flyTo({ center: [lng, lat] });
    place(lat, lng);
    setQuery(f.place_name);
    setResults([]);
  }

  async function confirm() {
    if (!marker) return;
    setResolving(true);
    const { area, address } = await reverseGeocode(marker.lng, marker.lat, accessToken).catch(() => ({
      area: null,
      address: null,
    }));
    setResolving(false);
    onConfirm({ lat: marker.lat, lng: marker.lng, area, address });
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-cream">
      <div className="relative z-20 shrink-0 border-b border-[var(--border-faint)] bg-cream p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search a place in Uganda…"
            className="w-full rounded-full border border-[var(--border-faint)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold"
          />
        </div>
        {(searching || results.length > 0) && (
          <div className="absolute inset-x-3 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] shadow-lg">
            {searching && <div className="p-3 text-xs text-ink-500">Searching…</div>}
            {results.map((f, i) => (
              <button
                key={i}
                onClick={() => chooseResult(f)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-ink hover:bg-[rgb(var(--surface-muted))]"
              >
                {f.place_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-1">
        {!ready && !loadError && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" strokeWidth={2.5} aria-hidden />
          </div>
        )}
        {loadError && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-700">
            Couldn&apos;t load Mapbox. Check the connection and try again.
          </div>
        )}
        <div ref={mapDivRef} className="h-full w-full" />

        {ready && (
          <button
            onClick={useMyLocation}
            className="absolute bottom-4 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] text-ink shadow-lg"
            aria-label="Use my current location"
          >
            <LocateFixed className="h-5 w-5 text-gold" strokeWidth={2.25} />
          </button>
        )}

        {ready && !marker && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-ink/80 px-3 py-1.5 text-xs font-medium text-cream">
              Tap the map to drop a pin
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-[var(--border-faint)] bg-cream p-3">
        <button
          onClick={onCancel}
          className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] text-sm font-bold text-ink"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={!marker || resolving}
          className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-gold text-base font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-50"
        >
          {resolving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {resolving ? "Finding address…" : "Use this location"}
        </button>
      </div>
    </div>
  );
}
