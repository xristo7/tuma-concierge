"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "lg";

const STORAGE_KEY = "tuma-language";

// Starter dictionary — covers the always-visible chrome (nav, header,
// account). Translating every screen in both apps is a much bigger job;
// this wires up the mechanism and the switch so screens can be added to
// this dictionary incrementally without touching the plumbing again.
const STRINGS: Record<string, { en: string; lg: string }> = {
  nav_home: { en: "Home", lg: "Awaka" },
  nav_orders: { en: "Orders", lg: "Ebiragiddwa" },
  nav_jobs: { en: "Jobs", lg: "Emirimu" },
  nav_active: { en: "Active", lg: "Ebikola" },
  nav_chat: { en: "Chat", lg: "Emboozi" },
  nav_wallet: { en: "Wallet", lg: "Ensawo" },
  nav_account: { en: "Account", lg: "Akawunti" },
  account_title: { en: "Account", lg: "Akawunti" },
  appearance_title: { en: "Appearance", lg: "Endabika" },
  appearance_auto: { en: "Auto", lg: "Byokka" },
  appearance_light: { en: "Light", lg: "Ekyakaawo" },
  appearance_dark: { en: "Dark", lg: "Ekizikiza" },
  language_title: { en: "Language", lg: "Olulimi" },
  language_english: { en: "English", lg: "Olungereza" },
  language_luganda: { en: "Luganda", lg: "Oluganda" },
  log_out: { en: "Log out", lg: "Fuluma" },
  change_location: { en: "Change location", lg: "Kyusa ekifo" },
  locating: { en: "Locating…", lg: "Nnoonya ekifo…" },

  // Home / jobs
  loading: { en: "Loading…", lg: "Kaloze…" },
  home_online: { en: "Online", lg: "Ali ku layini" },
  home_offline: { en: "Offline", lg: "Tali ku layini" },
  home_available_jobs: { en: "Available jobs", lg: "Emirimu Egiriwo" },
  home_all: { en: "All", lg: "Byonna" },
  home_sort: { en: "Sort", lg: "Longoosa" },
  home_sort_nearest: { en: "Nearest first", lg: "Ebikumpi mu maaso" },
  home_sort_price_high: { en: "Price: high to low", lg: "Omuwendo: waggulu okugenda wansi" },
  home_sort_price_low: { en: "Price: low to high", lg: "Omuwendo: wansi okugenda waggulu" },
  home_sort_newest: { en: "Newest first", lg: "Ebipya mu maaso" },
  home_sort_oldest: { en: "Oldest first", lg: "Ebikadde mu maaso" },
  home_go_online: { en: "Go online to see nearby orders.", lg: "Yingira ku layini olabe ebiragiddwa ebikumpi." },
  home_no_jobs: { en: "No open orders near you right now.", lg: "Tewali biragiddwa ebiggule bikumpi naawe kaakano." },
  home_no_category_jobs: { en: "No {category} jobs right now.", lg: "Tewali mirimu gya {category} kaakano." },
  home_km_away: { en: "km away", lg: "km bweraka" },
  home_distance_unknown: { en: "Distance unknown", lg: "Ebweraka tebumanyiddwa" },
  home_delivery: { en: "delivery", lg: "okutuusa" },
  home_out_of_range: { en: "Outside the normal service area — you can propose a higher fee once you take it.", lg: "Ebweru w'ekitundu ekya bulijjo — osobola okuwaayo omuwendo omusukiddwa nga wakimaze okukikwata." },
  home_preview: { en: "Preview", lg: "Laba Olubereberye" },
  home_claiming: { en: "Claiming…", lg: "Tukwata…" },
  home_offline_btn: { en: "Offline", lg: "Tewali Intaneeti" },
  home_claim_job: { en: "Claim job", lg: "Kwata omulimu" },
  home_applying: { en: "Applying…", lg: "Tusaba…" },
  home_applied: { en: "Applied ✓", lg: "Osabye ✓" },
  home_apply: { en: "Apply", lg: "Saba" },
  home_your_jobs: { en: "Your jobs", lg: "Emirimu gyo" },
  home_no_active_jobs: { en: "No active jobs yet — claim one above.", lg: "Tewali mulimu gukyakola — kwata ogumu waggulu." },
  home_hi: { en: "Hi", lg: "Ki kati" },
};

export type TranslationKey = keyof typeof STRINGS;

function readStored(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "lg") return v;
  } catch {}
  return "en";
}

const LanguageContext = createContext<{ language: Language; setLanguage: (l: Language) => void }>({
  language: "en",
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    setLanguageState(readStored());
  }, []);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslate() {
  const { language } = useLanguage();
  return (key: TranslationKey, params?: Record<string, string | number>) => {
    const template = STRINGS[key]?.[language] ?? STRINGS[key]?.en ?? key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      template,
    );
  };
}
