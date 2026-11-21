import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import {
  CodeChip,
  SeverityBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
} from '@/components/policy-watch/badges';
import { SourceForm } from '@/components/policy-watch/source-form';
import { StatusButtons } from '@/components/policy-watch/status-buttons';
import { changeCodes } from '@/lib/policy-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PolicyWatchPage() {
  const since7d = new Date(Date.now() - 7 * 86400000);
  const [sources, changes, digests, payers, chargemaster, openFindings, weekChanges] =
    await Promise.all([
      prisma.policySource.findMany({
        include: { payer: true, _count: { select: { snapshots: true, changes: true } } },
        orderBy: [{ payer: { name: 'asc' } }, { name: 'asc' }],
      }),
      prisma.policyChange.findMany({
        include: { source: { include: { payer: true } }, _count: { select: { findings: true } } },
        orderBy: { detectedAt: 'desc' },
        take: 25,
      }),
      prisma.dailyDigest.findMany({ orderBy: { digestDate: 'desc' }, take: 7 }),
      prisma.payer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.chargemaster.findFirst({ orderBy: { uploadedAt: 'desc' } }),
      prisma.auditFinding.count({ where: { status: 'OPEN' } }),
      prisma.policyChange.count({ where: { detectedAt: { gte: since7d } } }),
    ]);
  const chargemasterCodes = chargemaster
    ? new Set(
        (
          await prisma.chargemasterItem.findMany({
            where: { chargemasterId: chargemaster.id },
            select: { cptCode: true },
          })
        ).map((item) => item.cptCode),
      )
    : new Set<string>();
  const [latestDigest, ...olderDigests] = digests;
  const openHigh = changes.filter((c) => c.severity === 'HIGH' && c.status === 'NEW').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">Payer intelligence</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Policy watch</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Monitors payer policy index pages, diffs every change, summarizes the impact, and audits
            your chargemaster against affected CPT / HCPCS codes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/policy-watch/chargemaster"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Chargemaster audit
          </Link>
          <ActionButton
            endpoint="/api/policy-watch/run"
            label="Check all pages now"
            variant="primary"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Monitored pages',
            `${sources.filter((s) => s.enabled).length}`,
            `${sources.length} total`,
          ],
          ['Changes · 7 days', `${weekChanges}`, `${changes.length} shown below`],
          ['High impact · unreviewed', `${openHigh}`, 'Needs a decision'],
          [
            'Chargemaster findings',
            `${openFindings}`,
            chargemaster ? `${chargemaster.name}` : 'No chargemaster uploaded',
          ],
        ].map(([label, value, hint]) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Daily AI briefing</h2>
            <p className="text-xs text-slate-500">
              {latestDigest
                ? `${formatDate(latestDigest.digestDate)} · ${latestDigest.changeCount} change${latestDigest.changeCount === 1 ? '' : 's'} · ${latestDigest.aiModel ?? 'heuristic'}`
                : 'No briefing generated yet'}
            </p>
          </div>
          <ActionButton endpoint="/api/policy-watch/run" label="Regenerate briefing" />
        </div>
        {latestDigest ? (
          <div className="px-5 py-5">
            <h3 className="text-lg font-semibold text-slate-900">{latestDigest.headline}</h3>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
              {latestDigest.body}
            </pre>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">
            Run a check to fetch every monitored page and produce the first briefing.
          </p>
        )}
        {olderDigests.length > 0 && (
          <div className="border-t border-slate-100">
            {olderDigests.map((digest) => (
              <details key={digest.id} className="border-b border-slate-100 last:border-b-0">
                <summary className="cursor-pointer px-5 py-3 text-sm">
                  <span className="font-medium text-slate-700">
                    {formatDate(digest.digestDate)}
                  </span>
                  <span className="ml-3 text-slate-500">{digest.headline}</span>
                </summary>
                <pre className="whitespace-pre-wrap px-5 pb-4 font-sans text-sm leading-6 text-slate-600">
                  {digest.body}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Recent policy changes</h2>
          <span className="text-sm text-slate-500">Click a change to see the diff and impact</span>
        </div>
        {changes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No changes detected yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Detected</th>
                  <th className="px-5 py-3">Payer / page</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3">Codes</th>
                  <th className="px-5 py-3">Impact</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => {
                  const codes = changeCodes(change);
                  const hits = codes.filter((code) => chargemasterCodes.has(code));
                  return (
                    <tr key={change.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {formatDateTime(change.detectedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold">{change.source.payer.name}</div>
                        <div className="text-xs text-slate-500">{change.source.name}</div>
                      </td>
                      <td className="max-w-md px-5 py-4">
                        <Link
                          href={`/policy-watch/changes/${change.id}`}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {change.title}
                        </Link>
                        {change._count.findings > 0 && (
                          <div className="mt-1 text-xs font-medium text-orange-700">
                            {change._count.findings} chargemaster finding
                            {change._count.findings === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {codes.slice(0, 8).map((code) => (
                            <CodeChip key={code} code={code} highlight={hits.includes(code)} />
                          ))}
                          {codes.length > 8 && (
                            <span className="text-xs text-slate-500">+{codes.length - 8}</span>
                          )}
                          {codes.length === 0 && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <SeverityBadge severity={change.severity} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={change.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Monitored payer policy pages</h2>
            <p className="text-xs text-slate-500">
              Each page is fetched, normalized to text, hashed, and compared to its last snapshot.
            </p>
          </div>
          <SourceForm payers={payers} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Payer</th>
                <th className="px-5 py-3">Page</th>
                <th className="px-5 py-3">Last checked</th>
                <th className="px-5 py-3">Last changed</th>
                <th className="px-5 py-3">History</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-t border-slate-100 align-top">
                  <td className="px-5 py-4 font-semibold">{source.payer.name}</td>
                  <td className="max-w-sm px-5 py-4">
                    <Link
                      href={`/policy-watch/sources/${source.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {source.name}
                    </Link>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-slate-500 hover:text-blue-600"
                    >
                      {source.url}
                    </a>
                    {source.lastError && (
                      <p className="mt-1 text-xs text-red-600">
                        Last fetch failed: {source.lastError}
                      </p>
                    )}
                    {!source.enabled && (
                      <p className="mt-1 text-xs font-semibold text-slate-400">Paused</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDateTime(source.lastCheckedAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDateTime(source.lastChangedAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {source._count.snapshots} snapshot{source._count.snapshots === 1 ? '' : 's'} ·{' '}
                    {source._count.changes} change{source._count.changes === 1 ? '' : 's'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        endpoint={`/api/policy-sources/${source.id}/check`}
                        label="Check now"
                      />
                      <StatusButtons
                        endpoint={`/api/policy-sources/${source.id}`}
                        current={source.enabled ? 'on' : 'off'}
                        options={[
                          { value: 'on', label: 'Active', payload: { enabled: true } },
                          { value: 'off', label: 'Paused', payload: { enabled: false } },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-sm text-slate-500">
                    Add the policy index page for each payer you bill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
