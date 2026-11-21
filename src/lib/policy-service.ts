import {
  AuditFindingStatus,
  AuditFindingType,
  ChangeSeverity,
  PolicyChangeStatus,
  type PolicyChange,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auditChargemaster, parseChargemasterCsv, type AuditChange } from './chargemaster';
import {
  defaultSummarizer,
  generateDigest,
  heuristicSummarizer,
  type ChangeContext,
  type ChangeSummary,
  type Summarizer,
} from './policy-ai';
import { analyzeChange, type Signal } from './policy-diff';
import { extractTitle, hashContent, htmlToText } from './policy-text';
import { prisma } from './prisma';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ClearCyclePolicyWatch/1.0';

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const changeCodes = (change: PolicyChange) => parseJson<string[]>(change.affectedCodes, []);
export const changeSignals = (change: PolicyChange) => parseJson<Signal[]>(change.signals, []);
export const changeSummary = (change: PolicyChange) =>
  parseJson<ChangeSummary | null>(change.aiSummary, null);
export const changeLines = (value: string) => parseJson<string[]>(value, []);

function revalidatePolicyWatch() {
  try {
    revalidatePath('/policy-watch', 'layout');
  } catch {
    // Outside a Next.js request (seed / CLI); nothing to revalidate.
  }
}

export async function fetchPolicyPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Payer site responded ${response.status}.`);
    const html = await response.text();
    if (!html.trim()) throw new Error('Payer site returned an empty page.');
    return html;
  } finally {
    clearTimeout(timer);
  }
}

async function activeChargemaster() {
  return prisma.chargemaster.findFirst({
    orderBy: { uploadedAt: 'desc' },
    include: { items: true },
  });
}

/** Record a new snapshot; if content differs from the previous snapshot, create a PolicyChange. */
export async function recordSnapshot(
  sourceId: string,
  html: string,
  options: { summarizer?: Summarizer; fetchedAt?: Date } = {},
) {
  const source = await prisma.policySource.findUnique({
    where: { id: sourceId },
    include: { payer: true, snapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
  });
  if (!source) throw new Error('Policy source not found.');
  const content = htmlToText(html);
  const contentHash = hashContent(content);
  const previous = source.snapshots[0];
  const fetchedAt = options.fetchedAt ?? new Date();

  if (previous && previous.contentHash === contentHash) {
    await prisma.policySource.update({
      where: { id: sourceId },
      data: { lastCheckedAt: fetchedAt, lastError: null },
    });
    return { changed: false as const, snapshotId: previous.id };
  }

  const snapshot = await prisma.policySnapshot.create({
    data: {
      sourceId,
      fetchedAt,
      contentHash,
      title: extractTitle(html) ?? source.name,
      content,
      byteLength: html.length,
    },
  });
  await prisma.policySource.update({
    where: { id: sourceId },
    data: {
      lastCheckedAt: fetchedAt,
      lastError: null,
      ...(previous ? { lastChangedAt: fetchedAt } : {}),
    },
  });
  if (!previous) return { changed: false as const, snapshotId: snapshot.id, baseline: true };

  const analysis = analyzeChange(previous.content, content);
  const chargemaster = await activeChargemaster();
  const chargemasterCodes = chargemaster?.items.map((item) => item.cptCode);
  const summarizer = options.summarizer ?? defaultSummarizer();
  const context: ChangeContext = {
    payerName: source.payer.name,
    sourceName: source.name,
    url: source.url,
    severity: analysis.severity,
    diff: analysis.diff,
    signals: analysis.signals,
    affectedCodes: analysis.affectedCodes,
    chargemasterCodes,
  };
  let summary: ChangeSummary;
  let model = summarizer.model;
  try {
    summary = await summarizer.summarize(context);
  } catch {
    model = heuristicSummarizer.model;
    summary = await heuristicSummarizer.summarize(context);
  }

  const change = await prisma.policyChange.create({
    data: {
      sourceId,
      fromSnapshotId: previous.id,
      toSnapshotId: snapshot.id,
      detectedAt: fetchedAt,
      severity: analysis.severity as ChangeSeverity,
      title: summary.headline || analysis.title,
      addedLines: JSON.stringify(analysis.diff.added),
      removedLines: JSON.stringify(analysis.diff.removed),
      affectedCodes: JSON.stringify(analysis.affectedCodes),
      signals: JSON.stringify(analysis.signals),
      aiSummary: JSON.stringify(summary),
      aiModel: model,
    },
  });
  if (chargemaster) await runChargemasterAudit(chargemaster.id, [change.id]);
  return { changed: true as const, snapshotId: snapshot.id, changeId: change.id };
}

export async function checkSource(sourceId: string, summarizer?: Summarizer) {
  const source = await prisma.policySource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error('Policy source not found.');
  try {
    const html = await fetchPolicyPage(source.url);
    const result = await recordSnapshot(sourceId, html, { summarizer });
    revalidatePolicyWatch();
    return { sourceId, ok: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed.';
    await prisma.policySource.update({
      where: { id: sourceId },
      data: { lastCheckedAt: new Date(), lastError: message },
    });
    revalidatePolicyWatch();
    return { sourceId, ok: false as const, error: message };
  }
}

export async function checkAllSources(summarizer?: Summarizer) {
  const sources = await prisma.policySource.findMany({ where: { enabled: true } });
  const results = [];
  for (const source of sources) results.push(await checkSource(source.id, summarizer));
  const digest = await buildDailyDigest(new Date(), summarizer);
  return { results, digest };
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function buildDailyDigest(date: Date, summarizer = defaultSummarizer()) {
  const day = startOfDay(date);
  const next = new Date(day.getTime() + 86400000);
  const [changes, sourceCount, openFindings] = await Promise.all([
    prisma.policyChange.findMany({
      where: { detectedAt: { gte: day, lt: next } },
      include: { source: { include: { payer: true } } },
      orderBy: { detectedAt: 'desc' },
    }),
    prisma.policySource.count({ where: { enabled: true } }),
    prisma.auditFinding.count({ where: { status: AuditFindingStatus.OPEN } }),
  ]);
  const digest = await generateDigest(
    {
      date: day,
      sourcesChecked: sourceCount,
      openFindings,
      changes: changes.map((change) => ({
        payerName: change.source.payer.name,
        sourceName: change.source.name,
        severity: change.severity,
        affectedCodes: changeCodes(change),
        summary: changeSummary(change) ?? {
          headline: change.title,
          whatChanged: '',
          whyItMatters: '',
          whatToUpdate: [],
          codeImpacts: [],
        },
      })),
    },
    summarizer,
  );
  const saved = await prisma.dailyDigest.upsert({
    where: { digestDate: day },
    update: {
      changeCount: changes.length,
      sourceCount,
      headline: digest.headline,
      body: digest.body,
      aiModel: digest.model,
    },
    create: {
      digestDate: day,
      changeCount: changes.length,
      sourceCount,
      headline: digest.headline,
      body: digest.body,
      aiModel: digest.model,
    },
  });
  revalidatePolicyWatch();
  return saved;
}

export async function createSource(input: {
  payerId: string;
  name: string;
  url: string;
  description?: string;
}) {
  const url = new URL(input.url);
  if (!/^https?:$/.test(url.protocol)) throw new Error('URL must use http or https.');
  const source = await prisma.policySource.create({
    data: { ...input, url: url.toString() },
  });
  revalidatePolicyWatch();
  return source;
}

export async function setSourceEnabled(sourceId: string, enabled: boolean) {
  const source = await prisma.policySource.update({ where: { id: sourceId }, data: { enabled } });
  revalidatePolicyWatch();
  return source;
}

export async function deleteSource(sourceId: string) {
  await prisma.policySource.delete({ where: { id: sourceId } });
  revalidatePolicyWatch();
}

export async function updateChangeStatus(
  changeId: string,
  status: PolicyChangeStatus,
  notes?: string,
) {
  const change = await prisma.policyChange.update({
    where: { id: changeId },
    data: { status, ...(notes !== undefined ? { notes } : {}) },
  });
  revalidatePolicyWatch();
  return change;
}

export async function importChargemaster(name: string, fileName: string | null, csv: string) {
  const { rows, errors } = parseChargemasterCsv(csv);
  if (!rows.length) throw new Error(errors[0] ?? 'No chargemaster rows found.');
  const chargemaster = await prisma.chargemaster.create({
    data: {
      name,
      fileName,
      itemCount: rows.length,
      items: { create: rows },
    },
  });
  const findings = await runChargemasterAudit(chargemaster.id);
  revalidatePolicyWatch();
  return { chargemaster, imported: rows.length, warnings: errors, findings: findings.length };
}

/** Re-run the audit for a chargemaster. Scoped to `changeIds` when given (incremental). */
export async function runChargemasterAudit(chargemasterId: string, changeIds?: string[]) {
  const chargemaster = await prisma.chargemaster.findUnique({
    where: { id: chargemasterId },
    include: { items: true },
  });
  if (!chargemaster) throw new Error('Chargemaster not found.');
  const changes = await prisma.policyChange.findMany({
    where: {
      status: { not: PolicyChangeStatus.DISMISSED },
      ...(changeIds ? { id: { in: changeIds } } : {}),
    },
    include: { source: { include: { payer: true } } },
  });
  const drafts = auditChargemaster(
    chargemaster.items,
    changes.map((change): AuditChange => ({
      id: change.id,
      payerName: change.source.payer.name,
      sourceName: change.source.name,
      severity: change.severity,
      affectedCodes: changeCodes(change),
      signals: changeSignals(change),
      summary: changeSummary(change),
    })),
  );
  const existing = await prisma.auditFinding.findMany({
    where: { chargemasterId, ...(changeIds ? { changeId: { in: changeIds } } : {}) },
  });
  const keyOf = (f: { changeId: string | null; cptCode: string; type: string }) =>
    `${f.changeId}|${f.cptCode}|${f.type}`;
  const keep = new Map(existing.map((finding) => [keyOf(finding), finding]));
  const created = await prisma.$transaction(async (tx) => {
    await tx.auditFinding.deleteMany({
      where: {
        chargemasterId,
        status: AuditFindingStatus.OPEN,
        ...(changeIds ? { changeId: { in: changeIds } } : {}),
      },
    });
    const fresh = drafts.filter((draft) => {
      const prior = keep.get(keyOf(draft));
      return !prior || prior.status === AuditFindingStatus.OPEN;
    });
    if (fresh.length)
      await tx.auditFinding.createMany({
        data: fresh.map((draft) => ({
          chargemasterId,
          changeId: draft.changeId,
          cptCode: draft.cptCode,
          type: draft.type as AuditFindingType,
          severity: draft.severity as ChangeSeverity,
          message: draft.message,
          recommendation: draft.recommendation,
          evidence: draft.evidence,
        })),
      });
    await tx.chargemaster.update({
      where: { id: chargemasterId },
      data: { auditedAt: new Date() },
    });
    return fresh;
  });
  revalidatePolicyWatch();
  return created;
}

export async function updateFindingStatus(findingId: string, status: AuditFindingStatus) {
  const finding = await prisma.auditFinding.update({ where: { id: findingId }, data: { status } });
  revalidatePolicyWatch();
  return finding;
}
