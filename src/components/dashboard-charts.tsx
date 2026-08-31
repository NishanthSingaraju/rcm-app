'use client';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
export function DashboardCharts({
  aging,
  statuses,
  denials,
}: {
  aging: Record<string, number>;
  statuses: Array<{ name: string; value: number }>;
  denials: Array<{ reason: string; count: number }>;
}) {
  const agingData = Object.entries(aging).map(([bucket, amount]) => ({ bucket, amount }));
  const colors = ['#2563eb', '#14b8a6', '#f59e0b', '#f97316', '#ef4444'];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-4 font-semibold">A/R aging</h2>
        <div className="overflow-x-auto">
          <BarChart width={600} height={260} data={agingData}>
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Bar dataKey="amount" fill="#2563eb" radius={[5, 5, 0, 0]} />
          </BarChart>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 font-semibold">Claims by status</h2>
        <div className="flex items-center">
          <PieChart width={260} height={260}>
            <Pie
              data={statuses}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
            >
              {statuses.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            {statuses.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                {s.name}
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-5 xl:col-span-2">
        <h2 className="mb-4 font-semibold">Top denial reasons</h2>
        <div className="overflow-x-auto">
          <BarChart width={800} height={230} data={denials} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="reason" width={170} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#f97316" radius={[0, 5, 5, 0]} />
          </BarChart>
        </div>
      </div>
    </div>
  );
}
