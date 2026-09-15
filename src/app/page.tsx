import { PolicyWorkspace } from '@/components/policy-workspace';
import { policyDashboard } from '@/lib/policy-service';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return <PolicyWorkspace initialData={await policyDashboard()} />;
}
