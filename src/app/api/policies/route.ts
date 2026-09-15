import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  addPolicySource,
  generateBriefing,
  importCatalog,
  policyDashboard,
  syncSource,
} from '@/lib/policy-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('source'),
    name: z.string().trim().min(2).max(120),
    payer: z.string().trim().min(2).max(80),
    url: z.string().max(2000),
  }),
  z.object({ action: z.literal('sync'), id: z.string().max(100) }),
  z.object({ action: z.literal('toggle'), id: z.string().max(100), enabled: z.boolean() }),
  z.object({ action: z.literal('review'), id: z.string().max(100), reviewed: z.boolean() }),
  z.object({ action: z.literal('briefing'), isDemo: z.boolean() }),
]);

export async function GET() {
  return Response.json(await policyDashboard());
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && new URL(origin).host !== host)
  )
    return Response.json({ error: 'Cross-origin writes are not allowed.' }, { status: 403 });
  try {
    const buffer = await readBody(request, 2_100_000);
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await new Response(buffer, {
        headers: { 'Content-Type': request.headers.get('content-type')! },
      }).formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv'))
        throw new Error('Choose a CSV chargemaster file.');
      if (file.size > 2_000_000) throw new Error('The CSV must be smaller than 2 MB.');
      const count = await importCatalog(file.name.slice(0, 200), await file.text());
      return Response.json({
        message: `Imported ${count} charge rows. The policy audit is ready.`,
      });
    }
    const input = actionSchema.parse(JSON.parse(new TextDecoder().decode(buffer)));
    switch (input.action) {
      case 'source':
        await addPolicySource({ name: input.name, payer: input.payer, url: input.url });
        return Response.json({ message: 'Source added. Check it to save the first baseline.' });
      case 'sync': {
        const result = await syncSource(input.id);
        return Response.json({
          message: result.baseline
            ? 'Baseline saved. Future checks will detect differences.'
            : result.changed
              ? 'New page changes detected. Review the policy feed.'
              : 'Source checked. No changes since the last snapshot.',
        });
      }
      case 'review':
        await prisma.policyUpdate.update({
          where: { id: input.id },
          data: { reviewed: input.reviewed },
        });
        return Response.json({
          message: input.reviewed
            ? 'Policy marked as reviewed.'
            : 'Policy returned to your review queue.',
        });
      case 'toggle':
        await prisma.policySource.update({
          where: { id: input.id },
          data: { enabled: input.enabled },
        });
        return Response.json({
          message: input.enabled ? 'Source monitoring resumed.' : 'Source monitoring paused.',
        });
      case 'briefing':
        await generateBriefing(input.isDemo);
        return Response.json({ message: 'Your daily briefing is ready.' });
    }
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code === 'P2002'
            ? 'This source is already in your workspace.'
            : 'The requested record could not be updated.'
          : error instanceof Error
            ? error.message
            : 'Unable to complete the request.';
    return Response.json({ error: message }, { status: 400 });
  }
}

async function readBody(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('Upload exceeds the 2 MB limit.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
