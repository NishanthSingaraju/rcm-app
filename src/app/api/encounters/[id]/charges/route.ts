import { z } from 'zod';
import {
  addEncounterCharge,
  addEncounterDiagnosis,
  removeEncounterCharge,
  removeEncounterDiagnosis,
} from '@/lib/rcm-service';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add-charge'),
    cptCode: z.string().min(1),
    modifiers: z.string().optional(),
    units: z.number().int().min(1),
    chargeAmount: z.number().positive(),
    diagnosisPointers: z.string().min(1),
  }),
  z.object({ action: z.literal('remove-charge'), chargeLineId: z.string().min(1) }),
  z.object({ action: z.literal('remove-diagnosis'), diagnosisId: z.string().min(1) }),
  z.object({
    action: z.literal('add-diagnosis'),
    diagnosisCode: z.string().min(1),
    sequence: z.number().int().min(1),
  }),
]);
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = schema.parse(await request.json());
    if (data.action === 'add-charge') return Response.json(await addEncounterCharge(id, data));
    if (data.action === 'remove-charge')
      return Response.json(await removeEncounterCharge(data.chargeLineId));
    if (data.action === 'remove-diagnosis')
      return Response.json(await removeEncounterDiagnosis(data.diagnosisId));
    return Response.json(await addEncounterDiagnosis(id, data.diagnosisCode, data.sequence));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : 'Unable to update encounter.',
      },
      { status: 400 },
    );
  }
}
