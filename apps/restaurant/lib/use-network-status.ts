"use client";

import { useEffect, useState } from "react";

/** Starts `true` (SSR has no `navigator`, and assuming online avoids a
 * flash of the offline banner on every normal page load) and corrects
 * itself the moment the browser's own connectivity events fire. */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
