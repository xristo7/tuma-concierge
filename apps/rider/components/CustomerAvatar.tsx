"use client";

import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

/** The customer's own photo, shown once a rider is matched to their order —
 * the same trust signal the rider's own photo already gives customers, the
 * other way round. Silently falls back to a plain icon if there's none. */
export function CustomerAvatar({ customerId, hasPhoto }: { customerId: string; hasPhoto?: boolean }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || hasPhoto === false) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .userPhotoBlob(customerId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customerId, hasPhoto]);

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/15 text-gold">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}
