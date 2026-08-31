import { DashboardCharts } from '@/components/dashboard-charts';
import { agingBuckets, cleanClaimRate, daysInAR, denialRate, netCollectionRate, topDenialReasons } from '@/lib/metrics';
import { prisma } from '@/lib/prisma';

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
export default async function Home() {
  const claims = await prisma.claim.findMany({ include: { denials: true }, orderBy: { updatedAt: 'desc' } });
  const events = await prisma.claimEvent.findMany({ include: { claim: true }, orderBy: { createdAt: 'desc' }, take: 6 });
  const totalAR = claims.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const aging = agingBuckets(claims, new Date());
  const chargesMTD = claims.filter((c) => c.createdAt.getMonth() === new Date().getMonth()).reduce((s, c) => s + c.totalCharge, 0);
  const statuses = [...new Set(claims.map((c) => c.status))].map((name) => ({ name, value: claims.filter((c) => c.status === name).length }));
  const denials = topDenialReasons(claims.flatMap((c) => c.denials), 5);
  return <div className="space-y-8">
    <div><p className="text-sm font-medium text-blue-600">Monday, February 03, 2025</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">RCM dashboard</h1><p className="mt-2 text-slate-500">A clear view of your practice&apos;s financial health.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[['Total A/R', money(totalAR), 'Outstanding balance'], ['Days in A/R', daysInAR(totalAR, chargesMTD / 30).toFixed(1), 'Based on trailing charges'], ['Clean claim rate', percent(cleanClaimRate(claims)), 'First-pass submissions'], ['Denial rate', percent(denialRate(claims)), 'Adjudicated claims'], ['Net collection rate', percent(netCollectionRate(claims)), 'Paid / collectible'], ['Charges MTD', money(chargesMTD), 'Current month']].map(([label, value, note]) => <div className="card p-5" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>)}</div>
    <DashboardCharts aging={aging} statuses={statuses} denials={denials} />
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="card overflow-hidden xl:col-span-3"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">A/R aging detail</h2></div><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Bucket</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3 text-right">Share</th></tr></thead><tbody>{Object.entries(aging).map(([bucket, amount]) => <tr key={bucket} className="border-t border-slate-100"><td className="px-5 py-3 font-medium">{bucket} days</td><td className="px-5 py-3 text-right tabular-nums">{money(amount)}</td><td className="px-5 py-3 text-right text-slate-500">{totalAR ? percent(amount / totalAR) : '0.0%'}</td></tr>)}</tbody></table></div>
      <div className="card xl:col-span-2"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Recent activity</h2></div><div className="divide-y divide-slate-100">{events.map((event) => <div className="px-5 py-4" key={event.id}><p className="text-sm font-medium">{event.description}</p><p className="mt-1 text-xs text-slate-400">{event.claim.claimNumber} · {event.createdAt.toLocaleDateString()}</p></div>)}</div></div>
    </div>
  </div>;
}
