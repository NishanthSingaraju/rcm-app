import { importChargemaster } from '@/lib/policy-service';

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Attach a CSV file named "file".');
    if (file.size > MAX_BYTES) throw new Error('Chargemaster file must be under 10 MB.');
    const name = String(form.get('name') || file.name || 'Chargemaster');
    return Response.json(await importChargemaster(name, file.name || null, await file.text()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to import chargemaster.' },
      { status: 400 },
    );
  }
}
