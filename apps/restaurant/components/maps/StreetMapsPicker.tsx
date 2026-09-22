"use client";

import { OsmStyledPicker } from "./OsmStyledPicker";
import type { MapPickerProps } from "./map-types";

// Standard OpenStreetMap tiles — genuinely free, no key or signup required.
// (CARTO's "free" basemaps now gate anonymous use behind an API key, so we
// stick with OSM's own tile server and theme it with CSS instead.)
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** The default map picker — plain OpenStreetMap tiles via Leaflet, Nominatim
 * for search/reverse-geocoding. Free, no API key, never disabled by admin —
 * see ../LocationMapPicker.tsx for when a styled provider is used instead. */
export function StreetMapsPicker(props: MapPickerProps) {
  return <OsmStyledPicker {...props} tileUrl={TILE_URL} attribution={TILE_ATTRIBUTION} />;
}
