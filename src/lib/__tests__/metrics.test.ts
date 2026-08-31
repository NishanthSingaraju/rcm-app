import { describe, expect, it } from 'vitest';
import {
  agingBuckets,
  cleanClaimRate,
  daysInAR,
  denialRate,
  firstPassYield,
  netCollectionRate,
  topDenialReasons,
} from '../metrics';

const asOf = new Date('2025-01-31T00:00:00Z');
const claim = (days: number, balance = 100) => ({
  status: 'SUBMITTED',
  balance,
  totalPaid: 0,
  totalCharge: 100,
  totalAdjustment: 0,
  billedAt: new Date(asOf.getTime() - days * 86400000),
});
describe('RCM metrics', () => {
  it('uses exact aging boundaries', () =>
    expect(
      agingBuckets([claim(30), claim(31), claim(60), claim(61), claim(90), claim(120)], asOf),
    ).toEqual({ '0-30': 100, '31-60': 200, '61-90': 200, '91-120': 100, '120+': 0 }));
  it('calculates days in AR and handles zero', () => {
    expect(daysInAR(1000, 100)).toBe(10);
    expect(daysInAR(1000, 0)).toBe(0);
  });
  it('calculates clean claim rate', () =>
    expect(
      cleanClaimRate([
        { ...claim(1), cleanOnFirstPass: true },
        { ...claim(2), cleanOnFirstPass: false },
        { ...claim(3), status: 'DRAFT', cleanOnFirstPass: true },
      ]),
    ).toBe(0.5));
  it('calculates denial rate among adjudicated claims', () =>
    expect(
      denialRate([
        { ...claim(1), status: 'DENIED' },
        { ...claim(2), status: 'PAID' },
        { ...claim(3), status: 'SUBMITTED' },
      ]),
    ).toBe(0.5));
  it('calculates net collection rate and zero denominator', () => {
    expect(netCollectionRate([{ ...claim(1), totalPaid: 80 }])).toBe(0.8);
    expect(netCollectionRate([])).toBe(0);
  });
  it('calculates first pass yield and top denial reasons', () => {
    expect(firstPassYield([{ ...claim(1), cleanOnFirstPass: true }])).toBe(1);
    expect(
      topDenialReasons(
        [
          { carc: 'CO-16', reason: 'Missing information' },
          { carc: 'CO-16', reason: 'Missing information' },
          { carc: 'CO-18' },
        ],
        1,
      ),
    ).toEqual([{ reason: 'Missing information', count: 2 }]);
  });
});
