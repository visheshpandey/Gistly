# InsightFlow — Build Checklist

**Progress: about 95%.** Every feature is built and was tested in a real browser. What is left needs your accounts: deploying to Vercel and (optionally) moving storage to Supabase.
Last updated: 2026-10-11.

Legend: `[x]` done and tested, `[ ]` not done.

## What is left (needs you)
- [ ] **Deploy to Vercel.** Exact steps are in `README.md`. It needs your Vercel login and the three environment variables.
- [ ] **Supabase (optional).** Data, analysis, issues and reports are saved in each browser, so nothing is shared between people or devices yet. The schema is ready; it needs your Supabase URL and keys, plus code to read and write it.
- [x] **Dark mode.** Follows the computer's setting, with a toggle in the header that is remembered.
- [x] **New look.** Entry page at `/` (what the product does, sample or upload), top tab bar instead of a sidebar, tinted number cards, key takeaways and a ranked "fix these first" list on the dashboard, charts with values written on them.
- [ ] Add `Problem_Statement.pdf` to the repo (the file was never in the project folder).

## 0. Foundation
- [x] Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts
- [x] App shell with a responsive sidebar and mobile menu; 9 pages
- [x] Loading, empty and error states on every page
- [x] Renamed to InsightFlow; stray `cn` dependency checked (kept: every component uses it)
- [x] `.env.example` complete; `.env.local` ignored by git; keys never reach the browser (checked in the build output)
- [x] Font bug fixed (the UI was rendering in a serif font)
- [x] `shadcn` CLI moved to dev dependencies: `npm audit` for production dependencies reports 0 vulnerabilities
- [x] Dead "Search everything (coming soon)" box removed
- [x] Routes that call outside services allow up to 60 seconds, for hosts that cut functions off early

## a. Feedback management
- [x] Upload read in the browser: CSV, TSV, TXT, JSON, JSONL, Excel (.xlsx) or pasted text, with a column-mapping step (text, category, date), Excel sheet picker, "no header row" option, encoding detection (UTF-8/16, Windows-1252) and an optional "what is this about" line
- [x] Several datasets: sample and every upload kept separately (up to 25), switch from the top bar, rename, delete; each has its own analysis, Adaption result, issues, reports and Ask history
- [x] Add to the open dataset or create a new one; nothing is ever overwritten
- [x] Million-row files: read in a Web Worker, never freezes the page
- [x] Add to current data **or** replace it
- [x] Add a single review by hand
- [x] One-click sample data (also loads on first visit)
- [x] Table with search, sorting, pagination, and filters for category, sentiment and theme
- [x] Saved in the browser (IndexedDB) and kept after a refresh, including 100,000-row files; older single-dataset data is migrated automatically
- [ ] Saved in Supabase (see "What is left")

## b. Adaption and the instant local result
- [x] Verified against the official docs (`/adapt` not `/run`; upload needs a "complete" step)
- [x] Prompt Deduplication only; cost estimated first; the server refuses to run unless the confirmed cost matches
- [x] Runs kept short: each text at most 2 times, at most 400 rows, a repeatable sample (about 2 to 4 credits, 5 to 15 minutes at any size)
- [x] Instant local deduplication and quality score (A to F) in a worker: 1M rows in about 5 s in Node and 6 s in Edge, page never stalled more than 160 ms
- [x] Near-duplicate pass (MinHash) as an option
- [x] Verified by Adaption shown beside the instant score: "C · 6.2/10 (before D · 3.0, +107%)"
- [x] Background verification: starts by itself after an upload **only if the user turned it on**, and only within the credit limit they set (default 10); keeps running across pages; polls 5 s up to 15 s; picks up again after a reload
- [x] Reuses an earlier result for the same data by a fingerprint of what would be sent (tested: no new run on Adaption)
- [x] Completion message, highlight on the verified section, animated progress with elapsed time, "Try again" on failure, clear percentile label
- [x] Saved real Adaption result for the sample (`data/adaption-sample.json`)
- [x] Works with no key: clear message, instant result and saved results unaffected

## c. AI analysis (Google Gemini, `gemini-3.1-flash-lite`)
- [x] Themes, then labels in batches (sentiment, theme, severity, key issue, kind) with a response schema and validation
- [x] Numbers calculated by our code, weighted by repeats; the AI never writes a number; category never sent and never used as sentiment
- [x] AI Analysis page: progress, cancel, sentiment split, themes with quotes, sentiment inside each category
- [x] Saved real analysis of the sample; the last analysis of an upload is kept in the browser
- [x] **New data is analysed on its own:** only the new reviews are labelled (7 s for a few reviews), with a banner on every page when something is unanalysed
- [x] Near-identical issue phrases merged; small words in theme names tidied
- [x] Works with no key: clear message, saved results still shown

## d. Priorities and recommendations
- [x] Score = share of feedback × negative share × (average severity / 5), top problem = 100, every part shown
- [x] "Why it ranks here" built from the real numbers
- [x] AI-written suggested action per top problem, shown the numbers and quotes
- [x] "Getting worse / better / steady" tag from real dates (not part of the score)
- [x] 16 automated checks of the calculation code (`npm test`)

## e. Dashboard
- [x] Key numbers, answers to the main business questions, five charts, an evidence drawer
- [x] Filters for category, sentiment, theme and date; everything changes together
- [x] Cards hide themselves when their data is missing; no dates means no fake trend
- [x] Tested on the sample and on an uploaded dated file; checked at phone width (no sideways scrolling on any page)

## f. Ask, issues and reports
- [x] **Ask a question:** plan, then code calculates, then the AI explains. Group winners picked by code; every figure in an answer is checked; off-topic and prompt-injection questions refused
- [x] Issues: save from a recommendation, status open / in progress / resolved, notes, mentions now versus when saved
- [x] Reports: summary, priorities, strengths, themes, tracked issues; download as PDF (browser print), saved copies, share link that needs no account (works in a brand-new browser)

## g. Polish and ship
- [x] README with setup, architecture, "How we used Adaption", privacy, limits and deployment steps
- [x] `npm run lint`, `npm run build`, `npm test` all pass
- [x] Works on first load with sample data and no login
- [ ] Deployed to Vercel (see "What is left")

## Costs and cautions worth remembering
- A real Adaption run costs about 2 to 4 credits. While automatic checking is on, **every file import can start one**. In tests, set the setting directly with a credit limit of 1.
- Adding the same file twice in "Add" mode counts its feedback twice (the upload panel now says so). Upload it as a new dataset instead to start over.
- The AI's labels are a judgement. The example reviews shown next to every number are there so they can be checked.
