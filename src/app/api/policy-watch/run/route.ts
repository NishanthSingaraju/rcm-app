import { checkAllSources } from '@/lib/policy-service';

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.POLICY_WATCH_CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}` || new URL(request.url).searchParams.get('token') === secret;
}

async function run(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    return Response.json(await checkAllSources());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to run policy check.' },
      { status: 400 },
    );
  }
}

export const POST = run;
export const GET = run;
