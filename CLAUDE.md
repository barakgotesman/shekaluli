# שקלולי (Shekaluli)

A weight-tracking web app. React + TypeScript + Tailwind CSS (v4), frontend-only, all data persisted in `localStorage`. Built with Vite.

## Purpose

Let a single user log their daily weight, see progress on a graph against WHO BMI zones, browse full history grouped by year/month, view summary statistics, and control app settings (theme). No backend, no auth, no accounts — v1 is a local-only POC.

## Tech stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` / postcss config needed — see `vite.config.ts`)
- Dark mode uses Tailwind's class-based `dark:` variant, enabled via `@custom-variant dark (&:where(.dark, .dark *));` in `index.css` (Tailwind v4 defaults to OS-preference-based dark mode otherwise)
- **Recharts** for the weight-over-time line chart
- **react-router-dom** (`BrowserRouter`) for tab routing — clean URLs (`/settings`, `/history`, ...). Since this serves as static files, the host must rewrite all paths to `index.html` (see `vercel.json` and `public/_redirects` for Vercel/Netlify; other static hosts need an equivalent SPA fallback rule)
- **localStorage** as the only persistence layer (no server, no database)
- **jspdf** + **html2canvas** generate the coach progress-report PDF (`logic/pdfReport.ts`): jsPDF has no built-in Hebrew/RTL text shaping, so the report is built as a plain-HTML fragment, rendered off-screen, rasterized with html2canvas, then placed into a paginated jsPDF document as a JPEG image
- **vite-plugin-pwa** makes the app installable (manifest + auto-updating service worker, `generateSW` mode) — configured entirely in `vite.config.ts`, no extra source files. Icons live in `public/` (`pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`), generated from `public/favicon.svg`.
- UI language is Hebrew, RTL layout (`dir="rtl"` set in `index.html` and `App.tsx`); all displayed dates use Israeli `dd/mm/yyyy` format (`dates.ts`) even though data is stored as ISO `YYYY-MM-DD`

## Project structure

```
src/
  types.ts                 Profile and WeightEntry types
  App.tsx                   Root shell: onboarding gate, header, routed pages, bottom nav, add/edit modal state
  main.tsx                   Entry point, wraps App in react-router's BrowserRouter
  routes/
    AppRoutes.tsx            Route table (/graph /history /stats /settings) mapping paths to pages
  pages/
    GraphPage.tsx            Dashboard: insight banner, metric cards, WeightChart, goal-progress bar
    HistoryPage.tsx           Full weight history grouped by year then month (collapsible), with edit/delete/export
    StatsPage.tsx              % / kg change over last 15 days, 1 month, 3 months; all-time lowest/highest weight
    SettingsPage.tsx            Theme toggle, profile edit shortcut, export/import, storage-usage indicator
    OnboardingPage.tsx           Form to capture age, height, start weight, goal weight (also used to edit profile later)
  components/
    layout/
      Header.tsx                Fixed top app bar: logo/name + avatar (profile photo or placeholder)
      Footer.tsx                 Fixed bottom navigation bar: route tabs (via useLocation/useNavigate) + center "+" add button
    AddEntryModal.tsx          Modal overlay wrapping WeightForm, opened from the "+" nav button
    WeightForm.tsx              Date picker + WeightSlider, submits a weight entry
    WeightSlider.tsx             Draggable horizontal ruler for picking a weight value (scale/meter-style UI)
    WeightChart.tsx               Recharts line chart: weight vs. date, shaded WHO BMI zone bands, boundary lines, goal-weight line
  hooks/
    useAppData.ts             Owns profile/entries/theme state and every storage/export/import operation; the only thing pages talk to for persistence
  logic/
    storage.ts                localStorage read/write helpers (profile + entries)
    storageQuota.ts            localStorage usage estimate + quota-exceeded detection
    theme.ts                    Theme (light/dark) persistence + applying the `dark` class to <html>
    dataTransfer.ts              CSV/XLS export and CSV import parsing
    bmi.ts                        BMI math, WHO threshold constants, and entry/latest BMI selectors
    stats.ts                       Period-change, goal-progress-percent, and lowest/highest-entry calculations
    dates.ts                        ISO -> dd/mm/yyyy display formatting, plus today()
    timeframe.ts                     Date-range filtering for the graph's timeframe tabs
    pdfReport.ts                      Builds and downloads the "share with coach" PDF (StatsPage)
    image.ts                          Downscales/re-encodes an uploaded profile photo to a base64 JPEG
```

## Data model

- **Profile** (one per user, onboarding): `age`, `heightCm`, `startWeightKg`, `goalWeightKg`.
- **WeightEntry**: `{ date: 'YYYY-MM-DD', weightKg: number }`, one entry per calendar day (upsert on same date).
- **Theme**: `'light' | 'dark'`, defaults to light on first run, then sticky once the user picks one in Settings.

Profile and entries are stored as JSON under fixed localStorage keys (`shekaluli:profile`, `shekaluli:entries`); theme under `shekaluli:theme` — see `storage.ts` / `theme.ts`. There is no migration system; if these shapes change, existing localStorage data for early users may need manual clearing.

## Views and navigation

Tab switching uses `react-router-dom`'s `BrowserRouter` (`/graph`, `/history`, `/stats`, `/settings`), routed by `src/routes/AppRoutes.tsx` and rendered inside `App.tsx`'s shell. `components/layout/Footer.tsx` reads the active tab via `useLocation()` and switches via `useNavigate()` — it takes no `active`/`onChange` props. Unknown paths (including `/`) redirect to `/graph`. Onboarding is shown full-screen instead of the normal layout whenever no profile exists yet, or while editing the profile (`SettingsPage` -> "עריכת פרטים אישיים") — this is a plain conditional gate in `App.tsx`, not a route, since it isn't independently navigable.

- **Graph** (`/graph`, default): summary stat cards (start/goal/current weight, current BMI) + `WeightChart`.
- **History** (`/history`): `HistoryPage`, entries grouped by year then month (accordion), newest first.
- **Stats** (`/stats`): `StatsPage`, period-change cards (15d / 1mo / 3mo) and lowest/highest all-time entries.
- **Settings** (`/settings`): `SettingsPage`, light/dark theme buttons, edit-profile shortcut, export/import, storage-usage indicator, credit line ("פותח על ידי Barak Gotesman").

Adding a weight entry doesn't have its own view — the "+" button in the bottom nav opens `AddEntryModal` (wrapping `WeightForm`) as an overlay from any screen, defaulting to today's date and pre-filled with today's entry (if any), otherwise the latest logged weight, otherwise the profile's starting weight.

## BMI zones on the chart

`bmi.ts` converts BMI thresholds to absolute weight (kg) using the user's height, so `WeightChart` can render:
- Four shaded background bands (underweight / normal / overweight / obese — WHO BMI 18.5 / 25 / 30 cutoffs)
- Dashed boundary lines at each threshold, labeled with the zone that starts above it
- A dashed reference line at the user's goal weight

These are WHO standard adult thresholds — not personalized beyond height.

## Weight entry UI

`WeightSlider` renders a horizontal drag-to-select ruler (styled like a scale/meter widget) instead of a plain numeric input: a fixed center indicator with a scrolling tick strip behind it (minor ticks per 0.1 kg, labeled major ticks per whole kg), plus +/- 0.1 kg nudge buttons. Dragging is implemented with pointer events (no external gesture library).

## Conventions

- Tab routing uses `react-router-dom`'s `BrowserRouter`, kept intentionally minimal (4 routes + a wildcard redirect) — no data loaders, nested routes, or code-splitting.
- All Hebrew UI text lives directly in page/component JSX (no i18n layer — not needed for a single-language POC).
- Keep `components/` presentational; screen-level composition lives in `pages/`; all persisted state and storage/export/import orchestration lives in `hooks/useAppData.ts`, called once from `App.tsx` and passed down as props — pages never import `logic/storage.ts` or `logic/dataTransfer.ts` directly.
- Don't add a backend, auth, or multi-user support unless explicitly asked — this is intentionally a local-only POC.

## Coding style

- Every function — including small helpers — gets a JSDoc comment above it: what it does, `@param` for each parameter, `@returns` when it returns something non-obvious.
- Any complex or non-obvious block of logic (e.g. the BMI-to-weight conversion, year/month grouping in `HistoryPage`, drag-to-weight math in `WeightSlider`) gets an inline comment explaining the *why*, not just a restatement of the code.
- Keep JSDoc factual and short — describe behavior, not implementation history.

## Commands

- `npm run dev` — start dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm run preview` — preview the production build

## Git

- Every commit must have a detailed message: what changed and why, not just a one-line label. Avoid vague messages like "fix" or "update".
- All commits are authored as **Barak Gotesman** (barak.gotesman@gmail.com).
