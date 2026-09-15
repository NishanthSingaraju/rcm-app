# ClearCycle RCM

ClearCycle is a synthetic healthcare Revenue Cycle Management demo built with Next.js, Prisma, SQLite, and Recharts. It demonstrates charge capture, claim scrubbing, deterministic payer adjudication, remittances, denials, aging, and operational KPIs.

## Setup

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Use `npm run db:reset` to recreate the SQLite database and deterministic demo data. The app is available at `http://localhost:3000`.

Run `npm run format` to apply the repository's Prettier formatting rules to the source and seed trees.

## Walkthrough

The dashboard shows A/R aging, claims by status, denial reasons, and core collection KPIs. Claims provides a worklist and claim-level scrubber, line, and audit detail. Patients, encounters, denials, and remittances expose the seeded operational data.

## Policy Watch

`/policy-watch` monitors payer policy index pages (UHC, Aetna, Cigna, CMS HCPCS, Anthem are seeded), snapshots each page, and diffs normalized text between fetches. Every change gets a severity, detected billing signals (prior auth, non-coverage, code added/removed, modifier rules, frequency limits, effective dates), extracted CPT/HCPCS codes, and an AI summary covering what changed, why it matters, what to update, and per-code impact. Click into a change to see affected codes cross-referenced against your chargemaster and historical claim lines for that payer.

Upload a chargemaster (CSV/TSV with code, description, price columns; see `/sample-chargemaster.csv`) at `/policy-watch/chargemaster`. Every new policy change is automatically audited against the current chargemaster and produces findings with recommendations.

- `POST /api/policy-watch/run` re-checks all sources and builds today's digest. Point a cron at it for daily runs; set `POLICY_WATCH_CRON_SECRET` to require a bearer token.
- Summaries are deterministic by default. Set `OPENAI_API_KEY` (optionally `OPENAI_MODEL`, `OPENAI_BASE_URL`) to use an OpenAI-compatible model instead; failures fall back to the heuristic summary.
- Seeded snapshots are synthetic demo content. The first live check of each source replaces that baseline with the real page, so expect one large change per source on the first run.

## Architecture

Pure deterministic domain logic lives in `src/lib/money.ts`, `scrubber.ts`, `adjudicate.ts`, and `metrics.ts`; it has no Prisma dependency and is covered by Vitest. `src/lib/rcm-service.ts` owns persistence and transitions, while App Router server components handle reads and API handlers handle mutations.

All data is synthetic. This is a demonstration application, not a certified billing system, clearinghouse, or source of medical or financial advice.
