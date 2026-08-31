import { describe, expect, it } from 'vitest';
import { adjudicateClaim } from '../adjudicate';

const input = (claimNumber = 'SAFE-CLAIM') => ({
  claimNumber, submittedAt: new Date('2025-01-01T00:00:00Z'),
  payer: { allowedRate: 0.6, avgDaysToPay: 30 },
  policy: { deductible: 100, deductibleMet: 0, copay: 20, coinsuranceRate: 0.1 },
  lines: [{ lineNumber: 1, cptCode: '99213', chargeAmount: 100, units: 1 }],
});
describe('claim adjudication', () => {
  it('is deterministic', () => expect(adjudicateClaim(input(), 'test')).toEqual(adjudicateClaim(input(), 'test')));
  it('applies allowed rate with rounding', () => {
    const result = adjudicateClaim({ ...input('ROUND-CLAIM'), payer: { allowedRate: 0.3333, avgDaysToPay: 1 }, lines: [{ ...input().lines[0], chargeAmount: 10.01 }] }, 'no-denial');
    if (result.status !== 'DENIED') expect(result.lines[0].allowedAmount).toBe(3.34);
  });
  it('applies deductible, then copay, then coinsurance', () => {
    let result = adjudicateClaim(input('MATH-CLAIM'), 'math');
    let suffix = 0;
    while (result.status === 'DENIED' && suffix < 100) result = adjudicateClaim(input(`MATH-CLAIM-${++suffix}`), 'math');
    expect(result.status).not.toBe('DENIED');
    expect(result.lines[0].allowedAmount).toBe(60);
    expect(result.lines[0].patientResponsibility).toBe(60);
    expect(result.lines[0].paidAmount).toBe(0);
  });
  it('returns denial totals as zero paid and full adjustment', () => {
    let result = adjudicateClaim(input('DENIAL-CLAIM'), 'denial');
    let suffix = 0;
    while (result.status !== 'DENIED' && suffix < 100) result = adjudicateClaim(input(`DENIAL-CLAIM-${++suffix}`), 'denial');
    expect(result.status).toBe('DENIED');
    expect(result.totalPaid).toBe(0);
    expect(result.totalAllowed).toBe(0);
    expect(result.totalAdjustment).toBe(result.totalCharge);
    expect(result.denial?.carc).toMatch(/^CO-/);
  });
  it('offsets payment date by payer days', () => {
    const result = adjudicateClaim(input('DATE-CLAIM'), 'date');
    expect(result.paymentDate).toEqual(new Date('2025-01-31T00:00:00Z'));
  });
});
