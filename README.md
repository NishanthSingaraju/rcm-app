# PolicyPulse + ClearCycle RCM

PolicyPulse is a payer policy monitoring workspace with source snapshots, text comparisons, daily briefings, CPT/HCPCS code matching, CSV chargemaster import, and a persistent review queue. The existing ClearCycle tools are available at `/revenue`.

## PolicyPulse setup

Use Node.js 24 (verified with 24.19.0) and npm:

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run policies:seed
npm run dev
```

The home page opens a clearly labeled example workspace. Seeded policy changes, effective dates, summaries, and service descriptions are **synthetic**, not actual payer announcements. `policies:seed` is idempotent and never replaces an uploaded catalog. Switch to **Live sources** to see only captured live page changes. The same payer URL can exist in both datasets.

### Monitoring and daily summaries

1. Add an individual public HTML/text policy URL from a supported domain (listed in `src/lib/policy-fetch.ts`). The first **Check now** creates a baseline; subsequent checks create updates when text differs. Navigation and scripts are excluded. Snapshots and failed-check status persist in SQLite.
2. The generic connector checks only that page; it does **not** crawl linked policies or PDFs, authenticate to portals, or bypass bot protection. Add specific policy URLs individually. Sources returning unsupported content or access errors preserve the previous snapshot.
3. Set `OPENAI_API_KEY` in the server environment to enable AI-generated live briefings. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Only policy excerpts and matched code identifiers are sent to OpenAI, not chargemaster charges or patient data. Without a key, summaries explicitly use a rule-based engine. AI-provider errors surface without overwriting an existing briefing.
4. Run `npm run policies:daily` on the same persistent database, using a hosting scheduler once per day. The worker checks enabled live sources sequentially, records per-source failures, then saves the UTC day's briefing. UI requests alone do not schedule background work. Briefings are delivered in-app; email delivery is not implemented.

Example host cron (replace the path and ensure Node/npm are on cron's PATH):

```cron
0 7 * * * cd /absolute/path/to/rcm-app && /absolute/path/to/npm run policies:daily >> /absolute/path/to/policy-monitor.log 2>&1
```

The UI accurately reports that an external scheduler is required; a cron job is not installed by setup. Existing daily briefings are reused when their source facts and catalog code matches have not changed. Review status does not hide changes from the daily summary.

### Chargemaster audit

Upload a UTF-8 CSV (up to 2 MB / 10,000 rows) with `code`, `description`, and `charge`; `department` and `annual_volume` are optional. The upload dialog supplies a template. Common headers such as `CPT`, `CPT code`, `HCPCS`, and `charge amount` are accepted. Quoted fields, embedded newlines, leading-zero codes, HCPCS and category III code shapes, and duplicate codes across departments are supported. Invalid imports are rejected atomically, preserving the previous catalog.

Policy impacts are recalculated from exact code matches each time data loads, including after new source changes or uploads. Exports escape spreadsheet formulas. Associated gross charges are `charge × annual_volume`, not predicted reimbursement or revenue loss. Missing volume is not inferred.

**Scope:** code mentions are candidates, not verified coverage changes. This app does not include an authoritative licensed CPT/HCPCS feed and cannot confirm official new/deleted code validity. Effective dates and recommendations on generic live page changes require human interpretation; the app does not invent them. Always verify source, plan, jurisdiction, and contract before editing billing workflows.

### Operating boundary

This extends the original single-workspace demo. There is no application-level authentication or tenant isolation. Use the authorized Devin preview for evaluation. Before a public/production deployment, add authentication, authorization, workspace isolation, database backup/retention, licensed code data, and source-specific connectors. Do not upload patient information. JSON mutation endpoints reject cross-origin browser requests; URL allowlisting and redirect validation limit source fetches to supported public payer hosts.

### Checks

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Bundled Next.js documentation referenced by `AGENTS.md` is absent from the installed Next 15 package; consult the [Next 15 route handler documentation](https://nextjs.org/docs/15/app/api-reference/file-conventions/route). No pre-commit hook configuration is present.

## ClearCycle RCM

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
