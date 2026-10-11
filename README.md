# Gistly

Gistly turns piles of customer feedback into prioritized decisions. Import reviews, see what customers are saying, and decide what to fix first.

Status: early development. The app shell, feedback browser and database schema are in place. AI analysis, charts, recommendations and reports are planned.

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Postgres (schema only for now)
- Deployed on Vercel

## Getting started

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

The Feedback page reads `data/feedback.csv` (columns: `review`, `category`). See `data/README.md` for details.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values. Keys without the `NEXT_PUBLIC_` prefix are server-only and must never be exposed to the browser.

## Database

The initial schema lives in `supabase/migrations/0001_init.sql`. Run it in the Supabase SQL editor.

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build
- `npm run lint` lint the project
