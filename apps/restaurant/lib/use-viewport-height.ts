"use client";

import { useEffect, useState } from "react";

/** The visual viewport's current height in px — unlike the `dvh` CSS unit,
 * this reliably tracks the on-screen keyboard opening/closing on every
 * mobile browser tested, since `visualViewport` is exactly the API made
 * for this. A full-screen chat page uses this (not a `100dvh`-based
 * class) to size itself, so the composer stays glued to the real visible
 * bottom edge instead of drifting from the fixed bottom nav whenever the
 * keyboard's resize and `dvh`'s resize disagree. Returns null before the
 * first measurement (SSR / first paint) — callers fall back to a CSS class. */
export function useViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    function update() {
      setHeight(vv ? vv.height : window.innerHeight);
    }
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
