import { prisma } from '@/lib/prisma';
import Link from 'next/link';
export default async function EncountersPage() {
  const rows = await prisma.encounter.findMany({
    include: { patient: true, provider: true, chargeLines: true },
    orderBy: { dateOfService: 'desc' },
    take: 120,
  });
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-blue-600">Clinical operations</p>
        <h1 className="mt-1 text-3xl font-bold">Encounters</h1>
        <Link
          href="/encounters/new"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          New encounter
        </Link>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">Provider</th>
              <th className="px-5 py-3">POS</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Charges</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr className="border-t border-slate-100" key={e.id}>
                <td className="px-5 py-4">
                  <Link href={`/encounters/${e.id}`} className="text-blue-700 hover:underline">
                    {e.dateOfService.toLocaleDateString()}
                  </Link>
                </td>
                <td className="px-5 py-4 font-semibold">
                  {e.patient.firstName} {e.patient.lastName}
                </td>
                <td className="px-5 py-4">
                  {e.provider.firstName} {e.provider.lastName}
                </td>
                <td className="px-5 py-4">{e.placeOfService ?? '—'}</td>
                <td className="px-5 py-4">{e.status}</td>
                <td className="px-5 py-4 text-right tabular-nums">
                  ${e.chargeLines.reduce((s, l) => s + l.chargeAmount * l.units, 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
