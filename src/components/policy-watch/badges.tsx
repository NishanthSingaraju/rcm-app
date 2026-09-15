const SEVERITY_CLASSES: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
};

const STATUS_CLASSES: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  REVIEWED: 'bg-violet-50 text-violet-700 border-violet-200',
  ACTIONED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISMISSED: 'bg-slate-50 text-slate-500 border-slate-200',
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IGNORED: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES.LOW}`}
    >
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status] ?? STATUS_CLASSES.OPEN}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function CodeChip({ code, highlight }: { code: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-xs ${
        highlight
          ? 'border-orange-300 bg-orange-50 font-semibold text-orange-800'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
      title={highlight ? 'In your chargemaster' : undefined}
    >
      {code}
    </span>
  );
}

export const formatDateTime = (value: Date | null | undefined) =>
  value
    ? value.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export const formatDate = (value: Date | null | undefined) =>
  value
    ? value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
