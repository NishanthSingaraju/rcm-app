import { adjudicateAndPost } from '@/lib/rcm-service';
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await adjudicateAndPost((await params).id));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to adjudicate claim.' },
      { status: 400 },
    );
  }
}
