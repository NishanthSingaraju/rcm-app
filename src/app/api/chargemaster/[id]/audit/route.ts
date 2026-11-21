import { runChargemasterAudit } from '@/lib/policy-service';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const findings = await runChargemasterAudit((await params).id);
    return Response.json({ findings: findings.length });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to audit chargemaster.' },
      { status: 400 },
    );
  }
}
