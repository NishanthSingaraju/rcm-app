import { z } from 'zod';
import { appealDenial } from '@/lib/rcm-service';
const schema = z.object({ notes: z.string().optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(
      await appealDenial((await params).id, schema.parse(await request.json()).notes),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : 'Unable to appeal denial.',
      },
      { status: 400 },
    );
  }
}
