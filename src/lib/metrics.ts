import { round2 } from './money';

type MetricClaim = {
  status: string;
  balance: number;
  totalPaid: number;
  totalCharge: number;
  totalAdjustment: number;
  billedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  cleanOnFirstPass?: boolean | null;
};

export function agingBuckets(
  claims: MetricClaim[],
  asOf: Date | string,
): Record<'0-30' | '31-60' | '61-90' | '91-120' | '120+', number> {
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
  const now = asOf instanceof Date ? asOf : new Date(asOf);
  claims.forEach((claim) => {
    if (claim.balance <= 0) return;
    const start = claim.billedAt ?? claim.submittedAt;
    if (!start) return;
    const days = Math.max(0, Math.floor((now.getTime() - new Date(start).getTime()) / 86400000));
    const bucket =
      days <= 30
        ? '0-30'
        : days <= 60
          ? '31-60'
          : days <= 90
            ? '61-90'
            : days <= 120
              ? '91-120'
              : '120+';
    buckets[bucket] = round2(buckets[bucket] + claim.balance);
  });
  return buckets;
}
export function daysInAR(totalAR: number, avgDailyCharges: number): number {
  return avgDailyCharges > 0 ? round2(totalAR / avgDailyCharges) : 0;
}
export function cleanClaimRate(claims: MetricClaim[]): number {
  const submitted = claims.filter((c) => c.status !== 'DRAFT');
  return submitted.length
    ? round2(submitted.filter((c) => c.cleanOnFirstPass === true).length / submitted.length)
    : 0;
}
export function denialRate(claims: MetricClaim[]): number {
  const adjudicated = claims.filter((c) =>
    ['PAID', 'PARTIALLY_PAID', 'DENIED', 'CLOSED'].includes(c.status),
  );
  return adjudicated.length
    ? round2(adjudicated.filter((c) => c.status === 'DENIED').length / adjudicated.length)
    : 0;
}
export function netCollectionRate(claims: MetricClaim[]): number {
  const denominator = claims.reduce((s, c) => s + c.totalCharge - c.totalAdjustment, 0);
  return denominator > 0 ? round2(claims.reduce((s, c) => s + c.totalPaid, 0) / denominator) : 0;
}
export { cleanClaimRate as firstPassYield };
export function topDenialReasons(
  denials: Array<{ carc: string; reason?: string }>,
  n: number,
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  denials.forEach((d) => counts.set(d.reason ?? d.carc, (counts.get(d.reason ?? d.carc) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([reason, count]) => ({ reason, count }));
}
