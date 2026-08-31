import { z } from 'zod';
import { postPatientPayment } from '@/lib/rcm-service';
const schema = z.object({ amount: z.number().positive() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await postPatientPayment((await params).id, schema.parse(await request.json()).amount)); } catch (error) { return Response.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Unable to post payment.' }, { status: 400 }); }
}
