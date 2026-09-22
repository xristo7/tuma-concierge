export type PickedLocation = { lat: number; lng: number; area: string | null; address: string | null };

/** Shared interface every map-picker implementation (Streetmaps, Google,
 * Mapbox) renders behind — see ../LocationMapPicker.tsx, which picks
 * which one to mount based on the admin's active maps provider. */
export type MapPickerProps = {
  initial?: { lat: number; lng: number };
  onConfirm: (location: PickedLocation) => void;
  onCancel: () => void;
};
