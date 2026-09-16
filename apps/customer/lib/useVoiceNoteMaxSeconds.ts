import { useEffect, useState } from "react";
import { api } from "./api";

const DEFAULT_MAX_SECONDS = 60;

/** How long a voice recording may run before it auto-stops — admin-configurable (Settings > Voice recordings). */
export function useVoiceNoteMaxSeconds(): number {
  const [maxSeconds, setMaxSeconds] = useState(DEFAULT_MAX_SECONDS);
  useEffect(() => {
    api
      .getSettings()
      .then((res) => setMaxSeconds(res.settings.voiceNoteMaxSeconds))
      .catch(() => {});
  }, []);
  return maxSeconds;
}
