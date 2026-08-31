import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function RemittanceDetail({ params }: { params: Promise<{ id: string }> }) {
  const remittance = await prisma.remittance.findUnique({
    where: { id: (await params).id },
    include: {
      payer: true,
      lines: { include: { claim: { include: { patient: true } }, claimLine: true } },
    },
  });
  if (!remittance) return <div className="card p-8">Remittance not found.</div>;
  return (
    <div className="space-y-7">
      <Link href="/remittances" className="text-sm font-medium text-blue-600">
        ← Remittances
      </Link>
      <div>
        <p className="text-sm font-medium text-teal-600">{remittance.checkNumber}</p>
        <h1 className="mt-1 text-3xl font-bold">ERA check detail</h1>
        <p className="mt-2 text-slate-500">
          {remittance.payer.name} · {remittance.paymentDate.toLocaleDateString()}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">Total paid</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">${remittance.totalPaid.toFixed(2)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Posted</p>
          <p className="mt-2 text-2xl font-bold">
            {remittance.postedAt?.toLocaleDateString() ?? 'Pending'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Posted lines</p>
          <p className="mt-2 text-2xl font-bold">{remittance.lines.length}</p>
        </div>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Posted remittance lines</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Claim</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">CPT</th>
                <th className="px-5 py-3 text-right">Allowed</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3">CARC</th>
              </tr>
            </thead>
            <tbody>
              {remittance.lines.map((line) => (
                <tr className="border-t border-slate-100" key={line.id}>
                  <td className="px-5 py-4">
                    <Link className="font-semibold text-blue-700" href={`/claims/${line.claim.id}`}>
                      {line.claim.claimNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    {line.claim.patient.firstName} {line.claim.patient.lastName}
                  </td>
                  <td className="px-5 py-4">{line.claimLine.cptCode}</td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    ${line.allowedAmount.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    ${line.paidAmount.toFixed(2)}
                  </td>
                  <td className="px-5 py-4">{line.carc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
