import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  dateOfService: z.coerce.date(),
  placeOfService: z.string().optional(),
  notes: z.string().optional(),
});
export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    return Response.json(await prisma.encounter.create({ data: { ...data, status: 'OPEN' } }));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError ? error.issues[0]?.message : 'Unable to create encounter.',
      },
      { status: 400 },
    );
  }
}
