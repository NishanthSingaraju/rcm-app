import Link from 'next/link';
import { ActionButton } from '@/components/action-button';
import {
  CodeChip,
  SeverityBadge,
  StatusBadge,
  formatDateTime,
} from '@/components/policy-watch/badges';
import { changeCodes } from '@/lib/policy-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PolicySourcePage({ params }: { params: Promise<{ id: string }> }) {
  const source = await prisma.policySource.findUnique({
    where: { id: (await params).id },
    include: {
      payer: true,
      snapshots: { orderBy: { fetchedAt: 'desc' } },
      changes: { orderBy: { detectedAt: 'desc' } },
    },
  });
  if (!source)
    return (
      <div className="card p-8">
        Policy page not found.{' '}
        <Link className="text-blue-600" href="/policy-watch">
          Back to policy watch
        </Link>
      </div>
    );
  const latest = source.snapshots[0];
  const preview = latest?.content.split('\n').slice(0, 60) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/policy-watch" className="text-sm font-medium text-blue-600">
        ← Policy watch
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{source.payer.name}</p>
          <h1 className="mt-1 text-3xl font-bold">{source.name}</h1>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm text-blue-600 hover:underline"
          >
            {source.url}
          </a>
          {source.description && <p className="mt-2 text-slate-500">{source.description}</p>}
          {source.lastError && (
            <p className="mt-2 text-sm text-red-600">Last fetch failed: {source.lastError}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-slate-500">Last checked</p>
            <p className="font-semibold">{formatDateTime(source.lastCheckedAt)}</p>
          </div>
          <ActionButton
            endpoint={`/api/policy-sources/${source.id}/check`}
            label="Check now"
            variant="primary"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Change history</h2>
          </div>
          {source.changes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              No changes yet. The first fetch records a baseline; later fetches are compared to it.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {source.changes.map((change) => {
                const codes = changeCodes(change);
                return (
                  <li key={change.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDateTime(change.detectedAt)}</span>
                      <SeverityBadge severity={change.severity} />
                      <StatusBadge status={change.status} />
                    </div>
                    <Link
                      href={`/policy-watch/changes/${change.id}`}
                      className="mt-1 block font-semibold text-blue-700 hover:underline"
                    >
                      {change.title}
                    </Link>
                    {codes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {codes.slice(0, 12).map((code) => (
                          <CodeChip key={code} code={code} />
                        ))}
                        {codes.length > 12 && (
                          <span className="text-xs text-slate-500">+{codes.length - 12}</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Snapshots</h2>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {source.snapshots.map((snapshot) => (
              <li key={snapshot.id} className="px-5 py-3">
                <div className="font-medium">{formatDateTime(snapshot.fetchedAt)}</div>
                <div className="text-xs text-slate-500">
                  {snapshot.content.split('\n').length} lines ·{' '}
                  {Math.round(snapshot.byteLength / 1024)} KB · {snapshot.contentHash.slice(0, 10)}
                </div>
              </li>
            ))}
            {source.snapshots.length === 0 && (
              <li className="px-5 py-4 text-slate-500">No snapshots yet.</li>
            )}
          </ul>
        </section>
      </div>

      {latest && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Current page content (normalized)</h2>
            <p className="text-xs text-slate-500">
              {latest.title ?? source.name} · first {preview.length} lines
            </p>
          </div>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-xs leading-5 text-slate-700">
            {preview.join('\n')}
          </pre>
        </section>
      )}
    </div>
  );
}
