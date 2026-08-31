import { EncounterForm } from '@/components/encounter-form';
import { prisma } from '@/lib/prisma';

export default async function NewEncounterPage() {
  const [patients, providers] = await Promise.all([
    prisma.patient.findMany({
      select: { id: true, mrn: true, firstName: true, lastName: true },
      orderBy: { lastName: 'asc' },
    }),
    prisma.provider.findMany({
      select: { id: true, firstName: true, lastName: true, specialty: true },
      orderBy: { lastName: 'asc' },
    }),
  ]);
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-blue-600">Clinical operations</p>
        <h1 className="mt-1 text-3xl font-bold">New encounter</h1>
        <p className="mt-2 text-slate-500">Start a charge capture workflow for a patient visit.</p>
      </div>
      <EncounterForm patients={patients} providers={providers} />
    </div>
  );
}
