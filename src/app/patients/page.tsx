import { prisma } from '@/lib/prisma';
import Link from 'next/link';
export default async function PatientsPage() {
  const patients = await prisma.patient.findMany({
    include: { claims: { select: { balance: true } } },
    orderBy: { lastName: 'asc' },
  });
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-blue-600">Patient accounts</p>
        <h1 className="mt-1 text-3xl font-bold">Patients</h1>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">MRN</th>
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">DOB</th>
              <th className="px-5 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr className="border-t border-slate-100" key={p.id}>
                <td className="px-5 py-4 font-medium text-blue-700">{p.mrn}</td>
                <td className="px-5 py-4 font-semibold">
                  <Link href={`/patients/${p.id}`} className="hover:text-blue-700">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {p.dob?.toLocaleDateString() ?? 'Missing'}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  ${p.claims.reduce((s, c) => s + c.balance, 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
