import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import {
  CodeChip,
  SeverityBadge,
  StatusBadge,
  formatDateTime,
} from '@/components/policy-watch/badges';
import { ChargemasterUpload } from '@/components/policy-watch/chargemaster-upload';
import { StatusButtons } from '@/components/policy-watch/status-buttons';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const money = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ChargemasterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = typeof query.search === 'string' ? query.search.trim().toUpperCase() : '';
  const onlyFlagged = query.flagged === '1';

  const uploads = await prisma.chargemaster.findMany({ orderBy: { uploadedAt: 'desc' } });
  const current = uploads[0];
  const [items, findings] = current
    ? await Promise.all([
        prisma.chargemasterItem.findMany({
          where: { chargemasterId: current.id },
          orderBy: { cptCode: 'asc' },
        }),
        prisma.auditFinding.findMany({
          where: { chargemasterId: current.id },
          include: { change: { include: { source: { include: { payer: true } } } } },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
      ])
    : [[], []];
  const openByCode = new Map<string, number>();
  for (const finding of findings)
    if (finding.status === 'OPEN')
      openByCode.set(finding.cptCode, (openByCode.get(finding.cptCode) ?? 0) + 1);
  const visibleItems = items.filter(
    (item) =>
      (!search ||
        item.cptCode.includes(search) ||
        item.description.toUpperCase().includes(search)) &&
      (!onlyFlagged || openByCode.has(item.cptCode)),
  );
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const openFindings = findings
    .filter((finding) => finding.status === 'OPEN')
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
  const closedFindings = findings.filter((finding) => finding.status !== 'OPEN');

  return (
    <div className="space-y-7">
      <Link href="/policy-watch" className="text-sm font-medium text-blue-600">
        ← Policy watch
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-orange-600">Auto audit</p>
          <h1 className="mt-1 text-3xl font-bold">Chargemaster audit</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Every detected policy change is cross-referenced against your chargemaster. Findings
            tell you which lines to update, why, and what payer text triggered it.
          </p>
        </div>
        {current && (
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-semibold">{current.name}</p>
              <p className="text-slate-500">
                {current.itemCount} lines · audited {formatDateTime(current.auditedAt)}
              </p>
            </div>
            <ActionButton
              endpoint={`/api/chargemaster/${current.id}/audit`}
              label="Re-run audit"
              variant="primary"
            />
          </div>
        )}
      </div>

      <ChargemasterUpload />

      {current && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Open findings', openFindings.length],
              ['High severity', openFindings.filter((f) => f.severity === 'HIGH').length],
              ['Chargemaster lines flagged', openByCode.size],
            ].map(([label, value]) => (
              <div key={label} className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Open findings</h2>
            </div>
            {openFindings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No open findings. New policy changes are audited automatically as they are detected.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openFindings.map((finding) => (
                  <li
                    key={finding.id}
                    className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                  >
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <CodeChip code={finding.cptCode} highlight />
                        <SeverityBadge severity={finding.severity} />
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {finding.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800">{finding.message}</p>
                      <p className="mt-1 text-sm text-slate-600">{finding.recommendation}</p>
                      {finding.evidence && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                            Payer text that triggered this
                          </summary>
                          <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700">
                            {finding.evidence}
                          </pre>
                        </details>
                      )}
                      {finding.change && (
                        <Link
                          href={`/policy-watch/changes/${finding.change.id}`}
                          className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                        >
                          View policy change · {finding.change.source.payer.name} →
                        </Link>
                      )}
                    </div>
                    <StatusButtons
                      endpoint={`/api/audit-findings/${finding.id}`}
                      current={finding.status}
                      options={[
                        { value: 'RESOLVED', label: 'Mark resolved' },
                        { value: 'IGNORED', label: 'Ignore' },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
            {closedFindings.length > 0 && (
              <details className="border-t border-slate-100">
                <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-600">
                  {closedFindings.length} resolved / ignored
                </summary>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {closedFindings.map((finding) => (
                    <li
                      key={finding.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <CodeChip code={finding.cptCode} />
                        <StatusBadge status={finding.status} />
                        <span className="text-slate-600">{finding.message}</span>
                      </div>
                      <StatusButtons
                        endpoint={`/api/audit-findings/${finding.id}`}
                        current={finding.status}
                        options={[{ value: 'OPEN', label: 'Reopen' }]}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Chargemaster lines</h2>
              <form className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  name="search"
                  defaultValue={search}
                  placeholder="Search code or description"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-1.5 text-slate-600">
                  <input type="checkbox" name="flagged" value="1" defaultChecked={onlyFlagged} />
                  Flagged only
                </label>
                <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Filter
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Modifiers</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3 text-right">Price</th>
                    <th className="px-5 py-3">Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.slice(0, 500).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <CodeChip code={item.cptCode} highlight={openByCode.has(item.cptCode)} />
                      </td>
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-5 py-3 text-slate-500">{item.modifiers ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{item.department ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{money(item.price)}</td>
                      <td className="px-5 py-3">
                        {openByCode.has(item.cptCode) ? (
                          <span className="text-xs font-semibold text-orange-700">
                            {openByCode.get(item.cptCode)} open
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Clear</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-sm text-slate-500">
                        No lines match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {visibleItems.length > 500 && (
                <p className="px-5 py-3 text-xs text-slate-500">
                  Showing 500 of {visibleItems.length} lines. Use search to narrow.
                </p>
              )}
            </div>
          </section>

          {uploads.length > 1 && (
            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold">Upload history</h2>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {uploads.map((upload) => (
                  <li key={upload.id} className="flex justify-between px-5 py-3">
                    <span className={upload.id === current.id ? 'font-semibold' : ''}>
                      {upload.name}
                      {upload.fileName ? ` · ${upload.fileName}` : ''}
                    </span>
                    <span className="text-slate-500">
                      {upload.itemCount} lines · {formatDateTime(upload.uploadedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
