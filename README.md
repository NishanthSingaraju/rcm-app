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

## Architecture

Pure deterministic domain logic lives in `src/lib/money.ts`, `scrubber.ts`, `adjudicate.ts`, and `metrics.ts`; it has no Prisma dependency and is covered by Vitest. `src/lib/rcm-service.ts` owns persistence and transitions, while App Router server components handle reads and API handlers handle mutations.

All data is synthetic. This is a demonstration application, not a certified billing system, clearinghouse, or source of medical or financial advice.
