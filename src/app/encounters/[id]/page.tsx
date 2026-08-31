import Link from 'next/link';
import { ChargeCapture } from '@/components/charge-capture';
import { prisma } from '@/lib/prisma';

export default async function EncounterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: {
      patient: true,
      provider: true,
      diagnoses: { include: { diagnosis: true }, orderBy: { sequence: 'asc' } },
      chargeLines: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!encounter) return <div className="card p-8">Encounter not found.</div>;
  const [procedures, diagnosisCodes] = await Promise.all([
    prisma.procedureCode.findMany({ orderBy: { code: 'asc' } }),
    prisma.diagnosisCode.findMany({ orderBy: { code: 'asc' } }),
  ]);
  return (
    <div className="space-y-7">
      <Link href="/encounters" className="text-sm font-medium text-blue-600">
        ← Encounters
      </Link>
      <div>
        <p className="text-sm font-medium text-blue-600">
          {encounter.dateOfService.toLocaleDateString()} · POS{' '}
          {encounter.placeOfService ?? 'Missing'}
        </p>
        <h1 className="mt-1 text-3xl font-bold">
          {encounter.patient.firstName} {encounter.patient.lastName}
        </h1>
        <p className="mt-2 text-slate-500">
          {encounter.provider.firstName} {encounter.provider.lastName} ·{' '}
          {encounter.provider.specialty} · {encounter.status}
        </p>
      </div>
      <ChargeCapture
        encounterId={id}
        procedures={procedures}
        diagnoses={encounter.diagnoses}
        diagnosisCodes={diagnosisCodes}
        existingCharges={encounter.chargeLines}
        nextSequence={encounter.diagnoses.length + 1}
      />
    </div>
  );
}
