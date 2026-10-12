# Verdict architecture

A short guide to how the code is organised, so a new feature has an obvious home.

## The rule of thumb

- **`src/lib/`** is the brain: plain TypeScript with no React. Every number, rule and outside call lives here, and most of it is tested by the scripts in `scripts/`.
- **`src/features/`** and **`src/components/`** are the face: React that shows what `lib` worked out.
- **`src/providers/`** is the memory: the state that several pages share.
- **`src/app/`** is the routing: thin page files and API routes that call into `lib`.

If you are writing a calculation inside a component, it probably belongs in `src/lib/`.

## Folders

```
src/
  app/                      Next.js routes only (kept thin)
    page.tsx                entry page
    dashboard/ feedback/ analysis/ ask/ recommendations/ issues/ reports/ adaption/
                            each page.tsx = PageHeader + the feature's main component
    api/<feature>/<action>/route.ts
                            server routes, e.g. /api/analysis/label, /api/adaption/estimate
    error.tsx               friendly screen if a page crashes
    global-error.tsx        last resort if the whole app fails to load
    not-found.tsx           unknown addresses
    layout.tsx              fonts, theme script and the provider tree
    globals.css             design tokens (colours, fonts) and a few shared classes

  features/                 one folder per page or flow
    dashboard/              dashboard-view (page), dashboard-filters, evidence-sheet
    feedback/               feedback-workspace (page), feedback-table, add-feedback-sheet
    analysis/ ask/ recommendations/ issues/ reports/ adaption/
    upload/                 upload panel + provider (opened from anywhere)
    datasets/               dataset menu and sample banner
    landing/                entry-page buttons

  components/               reusable pieces with no page-specific knowledge
    ui/                     base controls (button, card, input, sheet…), shadcn style
    charts/                 charts.tsx (Recharts), mini-viz.tsx (plain SVG/HTML charts), palette.ts (colours)
    layout/                 app-shell, brand, page-header, theme-toggle
    shared/                 data-gate, chart-card, filter-chip, stat, kpi-cards, native-select, new-data-banner

  providers/                shared state (React context)
    data-provider           datasets on the shelf and the open one
    analysis-provider       the AI analysis of the open dataset
    adaption-provider       Adaption checks, including background runs
    issues-provider         tracked issues
    toast-provider          pop-up messages
    use-analysis-runner     running an analysis (hook used by the analysis page)

  lib/                      logic only, no React
    analysis/               metrics, priority score, insights, filters, AI prompts, Gemini client, running an analysis
    ask/                    turning a question into facts and checking the answer
    adaption/               Adaption client, sampling, fingerprinting
    local/                  in-browser file reading, deduplication and quality score (runs in a Web Worker)
    storage/                IndexedDB library of datasets, analyses and saved questions
    report/                 building a report and packing it into a share link
    issues/                 issue types
    server/                 server-only helpers: env.ts (reads keys), api.ts (route errors), service-error.ts
    feedback-types.ts       FeedbackRow, Dataset and other shared types
    csv.ts, dedupe.ts, feedback.ts, theme.ts, utils.ts

scripts/                    tests, benchmarks and tools (run with `node scripts/<name>.ts`)
```

## Shared state

`src/app/layout.tsx` nests the providers. The order matters because each can use the ones above it:

```
DataProvider > ToastProvider > AnalysisProvider > AdaptionProvider > IssuesProvider > UploadProvider > AppShell
```

Each provider exposes one hook (`useFeedbackData`, `useAnalysis`, `useAdaption`, `useIssues`, `useToast`, `useUpload`). Components read state through these hooks and never keep their own copy of shared data, so a change on one page shows everywhere at once.

Where data lives: datasets, analyses, Adaption results and saved questions in **IndexedDB** (`lib/storage`); issues, settings and the theme in **localStorage**. Nothing is sent to a database.

## How data flows

1. **Import:** a file is read in a Web Worker (`lib/local`), deduplicated and scored in seconds, and saved as a dataset.
2. **Analyse:** the browser sends unique review text in batches to `/api/analysis/*`; the server asks Gemini for labels (sentiment, theme, severity, main issue).
3. **Calculate:** `lib/analysis/metrics.ts`, `priority.ts` and `insights.ts` turn labels into every number on screen. The AI never writes a number.
4. **Show:** features render those numbers with the chart pieces in `components/charts`.
5. **Verify:** `/api/adaption/*` sends a sample to Adaption (estimate first, then run) and shows its quality score next to ours.

## API routes

- One folder per feature and one per action: `/api/<feature>/<action>`.
- Every handler is wrapped in `handleRoute()` from `lib/server/api.ts`. Errors always come back as `{ error, code }` with a sensible status, and unexpected errors are logged on the server without leaking details.
- Keys are read only in `lib/server/env.ts`. Gemini and Adaption errors extend `ServiceError`, so a missing key becomes a clear "not configured" message (status 503), not a crash.

## Adding things

**A new page**
1. Create `src/features/<name>/<name>-panel.tsx` (the UI) and put any calculation in `src/lib/<area>/`.
2. Create `src/app/<name>/page.tsx` that renders `<PageHeader>` and the panel.
3. Add the tab to `NAV` in `src/components/layout/app-shell.tsx`.

**A new API route**
1. Put the logic in `src/lib/<area>/` (testable without a server).
2. Create `src/app/api/<area>/<action>/route.ts`:
   ```ts
   import { badRequest, handleRoute } from "@/lib/server/api";
   export const POST = handleRoute(async (request: Request) => {
     const body = await request.json().catch(() => null);
     if (!body) return badRequest("Send a JSON body.");
     return Response.json(await doTheWork(body));
   });
   ```
3. If it needs a new key, add it to `lib/server/env.ts` and `.env.example`.

**A new colour or chart**: colours with a meaning go in `components/charts/palette.ts`; small charts go in `components/charts/mini-viz.tsx`.

## Conventions

- File names in `kebab-case`; components in `PascalCase`; hooks start with `use`; providers end with `Provider`.
- Comments explain *why*, in plain English, at the top of each module and next to non-obvious code.
- Every async screen has loading, empty and error states.
- Checks before shipping: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
