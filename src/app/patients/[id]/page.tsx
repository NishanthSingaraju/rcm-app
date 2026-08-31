import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const patient = await prisma.patient.findUnique({
    where: { id: (await params).id },
    include: {
      policies: { include: { payer: true }, orderBy: { rank: 'asc' } },
      encounters: { include: { provider: true }, orderBy: { dateOfService: 'desc' }, take: 12 },
      claims: { include: { payer: true }, orderBy: { createdAt: 'desc' }, take: 12 },
    },
  });
  if (!patient) return <div className="card p-8">Patient not found.</div>;
  const totalBalance = patient.claims.reduce((sum, claim) => sum + claim.balance, 0);
  return (
    <div className="space-y-7">
      <Link href="/patients" className="text-sm font-medium text-blue-600">
        ← Patients
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">{patient.mrn}</p>
          <h1 className="mt-1 text-3xl font-bold">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="mt-2 text-slate-500">
            {patient.dob?.toLocaleDateString() ?? 'DOB missing'} · Sex {patient.sex} ·{' '}
            {patient.city}, {patient.state}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total balance</p>
          <p className="text-2xl font-bold tabular-nums text-blue-700">
            ${totalBalance.toFixed(2)}
          </p>
        </div>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Insurance policies</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {patient.policies.map((policy) => (
            <div className="rounded-lg border border-slate-200 p-4" key={policy.id}>
              <div className="flex justify-between">
                <span className="font-semibold">{policy.payer.name}</span>
                <span className="text-xs font-bold text-blue-700">{policy.rank}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Member {policy.memberId} · Group {policy.groupNumber ?? '—'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {policy.effectiveFrom.toLocaleDateString()} –{' '}
                {policy.effectiveTo?.toLocaleDateString() ?? 'Current'}
              </p>
              <p className="mt-2 text-sm">
                Copay ${policy.copay.toFixed(2)} · Deductible ${policy.deductible.toFixed(2)} ($
                {policy.deductibleMet.toFixed(2)} met)
              </p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Recent encounters</h2>
          </div>
          {patient.encounters.map((encounter) => (
            <div
              className="flex justify-between border-b border-slate-100 px-5 py-4 text-sm"
              key={encounter.id}
            >
              <div>
                <p className="font-medium">{encounter.dateOfService.toLocaleDateString()}</p>
                <p className="text-slate-500">
                  {encounter.provider.firstName} {encounter.provider.lastName}
                </p>
              </div>
              <span className="text-slate-500">{encounter.status}</span>
            </div>
          ))}
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Claims</h2>
          </div>
          {patient.claims.map((claim) => (
            <Link
              href={`/claims/${claim.id}`}
              className="flex justify-between border-b border-slate-100 px-5 py-4 text-sm hover:bg-slate-50"
              key={claim.id}
            >
              <div>
                <p className="font-semibold text-blue-700">{claim.claimNumber}</p>
                <p className="text-slate-500">
                  {claim.payer.name} · {claim.status}
                </p>
              </div>
              <span className="tabular-nums">${claim.balance.toFixed(2)}</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
