import Link from 'next/link';
import {
  CodeChip,
  SeverityBadge,
  StatusBadge,
  formatDateTime,
} from '@/components/policy-watch/badges';
import { StatusButtons } from '@/components/policy-watch/status-buttons';
import { changeCodes, changeLines, changeSignals, changeSummary } from '@/lib/policy-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const money = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SIGNAL_LABEL: Record<string, string> = {
  PRIOR_AUTH: 'Prior authorization',
  NOT_COVERED: 'Coverage / medical necessity',
  CODE_REMOVED: 'Code removed or retired',
  CODE_ADDED: 'Code added',
  MODIFIER_RULE: 'Modifier rule',
  FREQUENCY_LIMIT: 'Frequency / unit limit',
  EFFECTIVE_DATE: 'Effective date',
  REIMBURSEMENT: 'Reimbursement',
};

export default async function PolicyChangePage({ params }: { params: Promise<{ id: string }> }) {
  const change = await prisma.policyChange.findUnique({
    where: { id: (await params).id },
    include: {
      source: { include: { payer: true } },
      fromSnapshot: true,
      toSnapshot: true,
      findings: { include: { chargemaster: true }, orderBy: { severity: 'asc' } },
    },
  });
  if (!change)
    return (
      <div className="card p-8">
        Change not found.{' '}
        <Link className="text-blue-600" href="/policy-watch">
          Back to policy watch
        </Link>
      </div>
    );

  const codes = changeCodes(change);
  const signals = changeSignals(change);
  const summary = changeSummary(change);
  const added = changeLines(change.addedLines);
  const removed = changeLines(change.removedLines);
  const since = new Date(Date.now() - 365 * 86400000);

  const [chargemaster, claimLines] = await Promise.all([
    prisma.chargemaster.findFirst({
      orderBy: { uploadedAt: 'desc' },
      include: { items: { where: { cptCode: { in: codes } } } },
    }),
    codes.length
      ? prisma.claimLine.findMany({
          where: {
            cptCode: { in: codes },
            claim: { payerId: change.source.payerId, createdAt: { gte: since } },
          },
          select: { cptCode: true, chargeAmount: true, paidAmount: true, claimId: true },
        })
      : Promise.resolve([]),
  ]);
  const chargemasterByCode = new Map(chargemaster?.items.map((item) => [item.cptCode, item]) ?? []);
  const exposure = codes.map((code) => {
    const lines = claimLines.filter((line) => line.cptCode === code);
    return {
      code,
      claims: new Set(lines.map((line) => line.claimId)).size,
      charges: lines.reduce((sum, line) => sum + line.chargeAmount, 0),
      paid: lines.reduce((sum, line) => sum + line.paidAmount, 0),
      item: chargemasterByCode.get(code),
      impact: summary?.codeImpacts.find((impact) => impact.code === code),
      signals: signals.filter((signal) => signal.codes.includes(code)),
    };
  });
  const totalExposure = exposure.reduce((sum, row) => sum + row.charges, 0);
  const signalKinds = [...new Set(signals.map((signal) => signal.kind))];

  return (
    <div className="space-y-6">
      <Link href="/policy-watch" className="text-sm font-medium text-blue-600">
        ← Policy watch
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{change.source.payer.name}</span>
            <span>·</span>
            <Link
              href={`/policy-watch/sources/${change.source.id}`}
              className="text-blue-600 hover:underline"
            >
              {change.source.name}
            </Link>
            <span>·</span>
            <span>{formatDateTime(change.detectedAt)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-900 lg:text-3xl">
            {change.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={change.severity} />
            <StatusBadge status={change.status} />
            <a
              href={change.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Open payer page ↗
            </a>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Review status</p>
          <StatusButtons
            endpoint={`/api/policy-changes/${change.id}`}
            current={change.status}
            options={[
              { value: 'NEW', label: 'New' },
              { value: 'REVIEWED', label: 'Reviewed' },
              { value: 'ACTIONED', label: 'Actioned' },
              { value: 'DISMISSED', label: 'Dismiss' },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">AI impact summary</h2>
            <span className="text-xs text-slate-500">{change.aiModel ?? 'heuristic'}</span>
          </div>
          {summary ? (
            <div className="mt-4 space-y-5 text-sm leading-6 text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What changed
                </p>
                <p className="mt-1">{summary.whatChanged}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Why you should update
                </p>
                <p className="mt-1">{summary.whyItMatters}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What to update
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {summary.whatToUpdate.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No summary available.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Detected signals</h2>
          {signalKinds.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {signalKinds.map((kind) => (
                <li key={kind} className="flex items-center justify-between">
                  <span>{SIGNAL_LABEL[kind] ?? kind}</span>
                  <span className="text-xs text-slate-500">
                    {signals.filter((signal) => signal.kind === kind).length} line
                    {signals.filter((signal) => signal.kind === kind).length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No billing-rule keywords detected.</p>
          )}
          <div className="mt-5 border-t border-slate-100 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your exposure (12 mo, this payer)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{money(totalExposure)}</p>
            <p className="text-xs text-slate-500">
              billed charges on {exposure.reduce((sum, row) => sum + row.claims, 0)} claim
              {exposure.reduce((sum, row) => sum + row.claims, 0) === 1 ? '' : 's'} using affected
              codes
            </p>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Affected CPT / HCPCS codes</h2>
            <p className="text-xs text-slate-500">
              Codes referenced in the changed text, matched to your chargemaster and claim history.
            </p>
          </div>
          <Link href="/policy-watch/chargemaster" className="text-sm font-semibold text-blue-600">
            Chargemaster audit →
          </Link>
        </div>
        {exposure.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No CPT / HCPCS codes appear in the changed text.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Chargemaster</th>
                  <th className="px-5 py-3">Impact</th>
                  <th className="px-5 py-3">Recommended action</th>
                  <th className="px-5 py-3 text-right">Claims · 12 mo</th>
                  <th className="px-5 py-3 text-right">Charges</th>
                </tr>
              </thead>
              <tbody>
                {exposure.map((row) => (
                  <tr key={row.code} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-4">
                      <CodeChip code={row.code} highlight={!!row.item} />
                      {row.signals.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {[...new Set(row.signals.map((s) => SIGNAL_LABEL[s.kind]))].join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.item ? (
                        <div>
                          <div className="font-medium">{row.item.description}</div>
                          <div className="text-xs text-slate-500">
                            {money(row.item.price)}
                            {row.item.modifiers ? ` · ${row.item.modifiers}` : ''}
                            {row.item.department ? ` · ${row.item.department}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not in chargemaster</span>
                      )}
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-700">
                      {row.impact?.impact ?? '—'}
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-700">
                      {row.impact?.action ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {row.claims > 0 ? (
                        <Link
                          href={`/claims?payer=${change.source.payerId}`}
                          className="font-semibold text-blue-700"
                        >
                          {row.claims}
                        </Link>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {row.charges ? money(row.charges) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {change.findings.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Chargemaster audit findings from this change</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {change.findings.map((finding) => (
              <li
                key={finding.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <CodeChip code={finding.cptCode} highlight />
                    <SeverityBadge severity={finding.severity} />
                    <span className="text-xs font-semibold text-slate-500">
                      {finding.type.replace('_', ' ')}
                    </span>
                    <StatusBadge status={finding.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{finding.message}</p>
                  <p className="mt-1 text-sm text-slate-500">{finding.recommendation}</p>
                </div>
                <StatusButtons
                  endpoint={`/api/audit-findings/${finding.id}`}
                  current={finding.status}
                  options={[
                    { value: 'OPEN', label: 'Open' },
                    { value: 'RESOLVED', label: 'Resolved' },
                    { value: 'IGNORED', label: 'Ignore' },
                  ]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">What the page says now vs. before</h2>
          <p className="text-xs text-slate-500">
            {change.fromSnapshot ? formatDateTime(change.fromSnapshot.fetchedAt) : '—'} →{' '}
            {formatDateTime(change.toSnapshot.fetchedAt)}
          </p>
        </div>
        <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Added ({added.length})
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {added.map((line, i) => (
                <li
                  key={`${i}-${line}`}
                  className="rounded border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-900"
                >
                  {line}
                </li>
              ))}
              {added.length === 0 && <li className="text-sm text-slate-400">Nothing added.</li>}
            </ul>
          </div>
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Removed ({removed.length})
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {removed.map((line, i) => (
                <li
                  key={`${i}-${line}`}
                  className="rounded border border-red-100 bg-red-50 px-3 py-1.5 text-red-900 line-through decoration-red-300"
                >
                  {line}
                </li>
              ))}
              {removed.length === 0 && <li className="text-sm text-slate-400">Nothing removed.</li>}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
