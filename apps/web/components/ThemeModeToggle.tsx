"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "../lib/theme";

export function ThemeModeToggle() {
  const { theme, toggle } = useThemeMode();
  const nextLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={nextLabel} title={nextLabel}>
      <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
