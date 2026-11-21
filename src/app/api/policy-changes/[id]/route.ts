import { PolicyChangeStatus } from '@prisma/client';
import { z } from 'zod';
import { updateChangeStatus } from '@/lib/policy-service';

const schema = z.object({
  status: z.enum(PolicyChangeStatus),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { status, notes } = schema.parse(await request.json());
    return Response.json(await updateChangeStatus((await params).id, status, notes));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to update change.' },
      { status: 400 },
    );
  }
}
