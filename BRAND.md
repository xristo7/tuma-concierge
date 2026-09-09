# Tuma brand — FE wiring

Palette + surface tokens live in both apps' `globals.css` / `tailwind.config.ts`.

## Palette (locked)

| Token | Hex | Role |
|-------|-----|------|
| gold | `#C9A227` | Accent / CTA |
| black / ink | `#0A0A0A` | Chrome / body text |
| green | `#1B7A4E` | Trust / success |
| cream | `#F7F3EE` | Page background |

## Surface tokens

From brand kit `SURFACE-TOKENS.md`: `--radius-card`, `--border-faint`, `--shadow-card`, `--shadow-card-hover`, `--pad-card`, `--transition-raise`. Utility class: `.card`.

## Source paths (outside this repo)

Canonical brand kit: **`tuma-brand/`** (local workspace: `/workspace/tuma-brand/`).

| Asset | Source | Wired into FE |
|-------|--------|---------------|
| Helmet wordmark SVG | `tuma-brand/lockups/helmet-wordmark.svg` | `apps/*/public/brand/tuma-logo-helmet-wordmark.svg` |
| Customer app icon | `tuma-brand/app-icons/customer-final.svg` | `apps/customer/public/brand/app-icon.svg` (+ favicon) |
| Rider app icon | `tuma-brand/app-icons/rider-final.svg` | `apps/rider/public/brand/app-icon.svg` (+ favicon) |
| Lucide map | `tuma-brand/icons/LUCIDE-MAP.md` | `packages/shared/docs/LUCIDE-MAP.md` |
| Surface tokens | `tuma-brand/SURFACE-TOKENS.md` | `apps/*/app/globals.css` |

## PNG cascade (not in this repo yet)

Raster exports (appicon sizes, lockup PNGs, icon PNG cascade) live under **`tuma-brand/exports/`**. They are **not** pushed via MCP (binary risk). Copy later when packaging for stores / splash:

- `tuma-brand/exports/appicons/`
- `tuma-brand/exports/lockups/`
- `tuma-brand/exports/icons/`

## Lucide

UI icons: `lucide-react` (see `packages/shared/docs/LUCIDE-MAP.md`). Logo helmet is custom SVG, not Lucide.
