import { AuditFindingStatus } from '@prisma/client';
import { z } from 'zod';
import { updateFindingStatus } from '@/lib/policy-service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { status } = z.object({ status: z.enum(AuditFindingStatus) }).parse(await request.json());
    return Response.json(await updateFindingStatus((await params).id, status));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to update finding.' },
      { status: 400 },
    );
  }
}
