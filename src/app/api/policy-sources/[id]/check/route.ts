import { checkSource } from '@/lib/policy-service';

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await checkSource((await params).id);
    if (!result.ok) return Response.json(result, { status: 502 });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to check policy source.' },
      { status: 400 },
    );
  }
}
