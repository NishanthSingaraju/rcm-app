import { z } from 'zod';
import { createSource } from '@/lib/policy-service';

const schema = z.object({
  payerId: z.string().min(1),
  name: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return Response.json(await createSource(input));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to add policy source.' },
      { status: 400 },
    );
  }
}
