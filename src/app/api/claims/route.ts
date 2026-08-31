import { z } from 'zod';
import { createClaimFromEncounter } from '@/lib/rcm-service';
const schema = z.object({ encounterId: z.string().min(1) });
export async function POST(request: Request) {
  try {
    return Response.json(
      await createClaimFromEncounter(schema.parse(await request.json()).encounterId),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : 'Unable to create claim.',
      },
      { status: 400 },
    );
  }
}
