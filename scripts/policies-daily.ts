import { runDailyMonitor } from '../src/lib/policy-service';
import { prisma } from '../src/lib/prisma';

runDailyMonitor()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Daily monitor failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
