import Link from 'next/link';
import { prisma } from '@/lib/prisma';

const colors: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
  DENIED: 'bg-red-50 text-red-700',
  READY: 'bg-blue-50 text-blue-700',
  SUBMITTED: 'bg-violet-50 text-violet-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  APPEALED: 'bg-orange-50 text-orange-700',
  CLOSED: 'bg-slate-100 text-slate-600',
  ACCEPTED: 'bg-teal-50 text-teal-700',
};

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const value = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : '');
  const search = value('search');
  const status = value('status');
  const payerId = value('payer');
  const aging = value('aging');
  const now = new Date();
  const minDate = aging
    ? new Date(
        now.getTime() -
          (aging === '120+' ? 3650 : Number(aging.split('-')[1] ?? 30) + 1) * 86400000,
      )
    : undefined;
  const maxDate =
    aging && aging !== '120+'
      ? new Date(now.getTime() - Number(aging.split('-')[0]) * 86400000)
      : undefined;
  const claims = await prisma.claim.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(payerId ? { payerId } : {}),
      ...(aging
        ? {
            billedAt: { ...(minDate ? { gte: minDate } : {}), ...(maxDate ? { lt: maxDate } : {}) },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { claimNumber: { contains: search } },
              {
                patient: {
                  OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }],
                },
              },
            ],
          }
        : {}),
    },
    include: { patient: true, payer: true },
    orderBy: { billedAt: 'desc' },
    take: 100,
  });
  const payers = await prisma.payer.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-blue-600">Revenue cycle</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Claims worklist</h1>
        <p className="mt-2 text-slate-500">Monitor every claim from draft through payment.</p>
      </div>
      <div className="card overflow-hidden">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4">
          <label className="min-w-48 flex-1 text-xs font-semibold uppercase text-slate-500">
            Search
            <input
              name="search"
              defaultValue={search}
              placeholder="Claim or patient"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-slate-500">
            Status
            <select
              name="status"
              defaultValue={status}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            >
              <option value="">All statuses</option>
              {[
                'DRAFT',
                'READY',
                'SUBMITTED',
                'ACCEPTED',
                'PAID',
                'PARTIALLY_PAID',
                'DENIED',
                'APPEALED',
                'CLOSED',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase text-slate-500">
            Payer
            <select
              name="payer"
              defaultValue={payerId}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            >
              <option value="">All payers</option>
              {payers.map((payer) => (
                <option key={payer.id} value={payer.id}>
                  {payer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase text-slate-500">
            Aging
            <select
              name="aging"
              defaultValue={aging}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            >
              <option value="">All aging</option>
              <option value="0-30">0–30 days</option>
              <option value="31-60">31–60 days</option>
              <option value="61-90">61–90 days</option>
              <option value="91-120">91–120 days</option>
              <option value="120+">120+ days</option>
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
            Apply
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Claim</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Payer</th>
                <th className="px-5 py-3">DOS</th>
                <th className="px-5 py-3 text-right">Charge</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold text-blue-700">
                    <Link href={`/claims/${claim.id}`}>{claim.claimNumber}</Link>
                  </td>
                  <td className="px-5 py-4">
                    {claim.patient.firstName} {claim.patient.lastName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{claim.payer.name}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {claim.billedAt?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    ${claim.totalCharge.toFixed(2)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[claim.status] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {claim.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums">
                    ${claim.balance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
