import { z } from 'zod';
import { deleteSource, setSourceEnabled } from '@/lib/policy-service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(await request.json());
    return Response.json(await setSourceEnabled((await params).id, enabled));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to update policy source.' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteSource((await params).id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to delete policy source.' },
      { status: 400 },
    );
  }
}
