import { DenialActions } from '@/components/denial-actions';
import { prisma } from '@/lib/prisma';

export default async function DenialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const category = typeof query.category === 'string' ? query.category : '';
  const status = typeof query.status === 'string' ? query.status : '';
  const rows = await prisma.denial.findMany({
    where: {
      ...(category ? { category: category as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: { claim: { include: { patient: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const grouped = rows.reduce<Record<string, typeof rows>>((groups, denial) => {
    (groups[denial.carc] ??= []).push(denial);
    return groups;
  }, {});
  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-orange-600">Exceptions</p>
        <h1 className="mt-1 text-3xl font-bold">Denials worklist</h1>
        <p className="mt-2 text-slate-500">
          Resolve, appeal, or write off outstanding payer denials.
        </p>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-5">
        <label className="text-xs font-semibold uppercase text-slate-500">
          Category
          <select
            name="category"
            defaultValue={category}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          >
            <option value="">All categories</option>
            {[
              'ELIGIBILITY',
              'CODING',
              'AUTHORIZATION',
              'TIMELY_FILING',
              'DUPLICATE',
              'MEDICAL_NECESSITY',
              'OTHER',
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-slate-500">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          >
            <option value="">All statuses</option>
            {['OPEN', 'IN_PROGRESS', 'APPEALED', 'WRITTEN_OFF', 'RESOLVED'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          Apply
        </button>
      </form>
      {Object.entries(grouped).map(([carc, denials]) => (
        <section className="card overflow-hidden" key={carc}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">CARC {carc}</h2>
            <span className="text-sm text-slate-500">
              {denials.length} denial{denials.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Claim</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {denials.map((denial) => (
                  <tr className="border-t border-slate-100" key={denial.id}>
                    <td className="px-5 py-4 font-semibold text-blue-700">
                      {denial.claim.claimNumber}
                    </td>
                    <td className="px-5 py-4">
                      {denial.claim.patient.firstName} {denial.claim.patient.lastName}
                    </td>
                    <td className="px-5 py-4">{denial.reason}</td>
                    <td className="px-5 py-4">{denial.category}</td>
                    <td className="px-5 py-4">{denial.status}</td>
                    <td className="px-5 py-4">
                      <DenialActions
                        denialId={denial.id}
                        closed={denial.status === 'WRITTEN_OFF' || denial.status === 'RESOLVED'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
