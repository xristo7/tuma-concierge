/** Opens turn-by-turn navigation to a destination in the native Google
 * Maps app when installed, falling back to the mobile browser otherwise.
 *
 * Tries the platform-specific app scheme first (which does nothing if the
 * app isn't installed, rather than erroring), then falls back to Google's
 * universal web directions URL if the page is still in the foreground a
 * moment later — i.e. the scheme didn't hand off to another app. Nothing
 * fires if the tab lost focus in that window, since that means the app
 * scheme worked.
 */
export function openMapsNavigation(lat: number, lng: number) {
  const dest = `${lat},${lng}`;
  const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const scheme = isIOS
    ? `comgooglemaps://?daddr=${dest}&directionsmode=driving`
    : isAndroid
      ? `google.navigation:q=${dest}`
      : null;

  if (!scheme) {
    window.open(universalUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const fallbackTimer = setTimeout(() => {
    if (!document.hidden) window.location.href = universalUrl;
  }, 1500);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) clearTimeout(fallbackTimer);
    },
    { once: true },
  );

  window.location.href = scheme;
}
