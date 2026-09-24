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
  nav_food: { en: "Food", lg: "Emmere" },
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

  // Home — greeting
  greeting_morning: { en: "Morning", lg: "Wasuze otya" },
  greeting_afternoon: { en: "Afternoon", lg: "Osiibye otya" },
  greeting_evening: { en: "Evening", lg: "Osasuse otya" },
  greeting_subtitle: { en: "Ready to shop? Send the list — we handle the rest.", lg: "Oteekateeka okugula? Tuwe olukalala — ebisigadde tubikola." },
  greeting_verified: { en: "Webale. Verified riders near you.", lg: "Webale. Abatambuze abakakasiddwa bali kumpi naawe." },

  // Home — trust banner
  trust_title: { en: "Fast. Reliable. Trusted.", lg: "Yangu. Yesigika. Yesigamiddwa." },
  trust_subtitle: { en: "Verified riders in your area.", lg: "Abatambuze abakakasiddwa mu kitundu kyo." },

  // Home — order type cards
  ride_title: { en: "Book a Ride", lg: "Tereka Ekigendererwa" },
  ride_subtitle: { en: "Get picked up, go anywhere", lg: "Tolekebwa, ogende wonna" },
  food_title: { en: "Order Food", lg: "Laga Emmere" },
  food_subtitle: { en: "Browse restaurants near you", lg: "Laba amaduuka g'emmere agali kumpi naawe" },
  shopping_title: { en: "Shopping List", lg: "Olukalala lw'Okugula" },
  shopping_subtitle: { en: "Items, groceries, errands", lg: "Ebintu, emmere, n'ebirala" },
  parcel_title: { en: "Parcel Delivery", lg: "Okutwala Ebintu" },
  parcel_subtitle: { en: "Send or receive a package", lg: "Sindika oba ofune ekipakedde" },

  // Home — active order
  active_order_title: { en: "Active order", lg: "Ekiragiddwa ekikola" },
  active_order_track: { en: "Track", lg: "Goberera" },
  active_order_payment_needed: { en: "Payment needed", lg: "Wetaagisa okusasula" },
  active_order_ready_pay: { en: "A rider is ready — tap to pay and send your order.", lg: "Omutambuze mwetegefu — nyiga osasule otume ekiragiddwa kyo." },
  active_order_heading_to: { en: "Heading to", lg: "Alaga e" },

  // Home — recent lists
  recent_lists_title: { en: "Recent lists", lg: "Enkalala ez'omulembe" },
  see_all: { en: "See all", lg: "Laba byonna" },
  items_count: { en: "items", lg: "ebintu" },

  // Home — wallet card
  wallet_escrow_title: { en: "Personal MoMo Escrow", lg: "Ensimbi zo ez'oku Layini" },
  wallet_protected: { en: "Protected", lg: "Ekuumiddwa" },
  wallet_top_up: { en: "Top up", lg: "Teekamu Ssente" },
  wallet_cap: { en: "Cap", lg: "Ekkomo" },
  wallet_verified: { en: "Verified", lg: "Ekakasiddwa" },
  wallet_details: { en: "Details", lg: "Ebisingawo" },
  wallet_family_pool: { en: "Family Pool", lg: "Ensawo y'Amaka" },
  wallet_active: { en: "Active", lg: "Ekola" },
  wallet_available_for_orders: { en: "Available for orders", lg: "Eyesigika ku biragiddwa" },
  wallet_manage: { en: "Manage", lg: "Ddaala" },
  wallet_staff_family_access: { en: "Staff & Family Access", lg: "Okuyingira kw'Abakozi n'Amaka" },
  wallet_settings: { en: "Settings", lg: "Entegeka" },

  // Home — fee proposal
  fee_proposal_suggests: { en: "Your rider suggests a new delivery fee:", lg: "Omutambuze wo awadde omuwendo omupya ogw'okutwala:" },
  fee_proposal_was: { en: "was", lg: "gwali" },
  accept: { en: "Accept", lg: "Kkiriza" },
  reject: { en: "Reject", lg: "Gaana" },
  view: { en: "View", lg: "Laba" },

  // Orders list
  orders_title: { en: "Orders", lg: "Ebiragiddwa" },
  orders_new: { en: "New", lg: "Ekipya" },
  orders_no_lists: { en: "No lists yet. Tap “New” to send your first shopping list.", lg: "Tewali lukalala. Nyiga “Ekipya” osindike olukalala lwo olusooka." },
  orders_lists_heading: { en: "Lists", lg: "Enkalala" },

  // Chat list
  chat_title: { en: "Chat", lg: "Emboozi" },
  chat_no_conversations: { en: "You have no conversations yet.", lg: "Tolina mboozi n'emu." },
  chat_send_list: { en: "Send a shopping list", lg: "Sindika olukalala lw'okugula" },
  chat_filter_all: { en: "All", lg: "Byonna" },
  chat_filter_riders: { en: "Riders", lg: "Abatambuze" },
  chat_filter_restaurants: { en: "Restaurants", lg: "Amaduuka g'Emmere" },
  chat_kind_rider: { en: "Rider", lg: "Omutambuze" },
  chat_kind_restaurant: { en: "Restaurant", lg: "Eduuka ly'Emmere" },
  loading: { en: "Loading…", lg: "Kaloze…" },

  // Account
  account_matching_heading: { en: "How should riders be matched?", lg: "Abatambuze bandigerekebwa batya?" },
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
  return (key: TranslationKey) => STRINGS[key]?.[language] ?? STRINGS[key]?.en ?? key;
}
