# שקלולי (Shekaluli)

A weight-tracking web app. Log your daily weight, see progress on a graph against WHO BMI zones, browse full history, view summary statistics, and share a progress report with your coach.

Frontend-only — no backend, no auth, no accounts. All data is stored in the browser's `localStorage`.

## Features

- Daily weight logging with a drag-to-select scale-style slider
- Progress graph with WHO BMI zone bands and a goal-weight reference line
- Full history browser, grouped by year and month
- Summary statistics (15-day / 1-month / 3-month change, all-time low/high)
- Light/dark theme
- CSV export and import
- PDF progress report generation, for sharing with a coach
- Installable as a PWA

## Tech stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) for the weight chart
- [react-router-dom](https://reactrouter.com/) for tab routing
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) for PDF report generation
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for installability

See `CLAUDE.md` for a full architecture overview.

## Getting started

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run oxlint |

## Deployment

The app is a static SPA — any static host works, as long as unknown paths are rewritten to `index.html` (see `vercel.json` / `public/_redirects`).

## Data & privacy

All data (profile and weight entries) is stored only in the browser's `localStorage`. Nothing is sent to a server. Clearing browser data or storage for this site will erase all logged data.
