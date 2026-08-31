import { describe, expect, it } from 'vitest';
import { scrubClaim, type ScrubInput } from '../scrubber';

const base = (): ScrubInput => ({
  patient: { dob: new Date('1980-01-01'), sex: 'F' },
  payer: { planType: 'COMMERCIAL' },
  policy: { effectiveFrom: new Date('2020-01-01') },
  dateOfService: new Date('2025-01-01'),
  provider: { npi: '1234567890' },
  placeOfService: '11',
  diagnoses: [{ sequence: 1, sexSpecific: 'ANY' }],
  lines: [
    {
      cptCode: '99213',
      modifiers: '',
      units: 1,
      chargeAmount: 100,
      diagnosisPointers: '1',
      isEvalAndManagement: true,
    },
  ],
  asOf: new Date('2025-01-15'),
});
const codes = (input: Partial<ScrubInput>) =>
  scrubClaim({ ...base(), ...input }).map((e) => e.code);

describe('claim scrubber', () => {
  it.each([
    ['E001', { patient: { dob: null, sex: 'F' } }],
    ['E002', { policy: null }],
    ['E003', { diagnoses: [] }],
    ['E004', { lines: [{ ...base().lines[0], diagnosisPointers: '9' }] }],
    ['E005', { lines: [{ ...base().lines[0], units: 0 }] }],
    ['E006', { provider: { npi: 'bad' } }],
    ['E007', { placeOfService: null }],
    ['E008', { duplicateCptCodes: ['99213'] }],
    ['W001', { asOf: new Date('2025-05-01') }],
    ['W002', { lines: [{ ...base().lines[0], modifiers: '25', isEvalAndManagement: false }] }],
    ['W003', { diagnoses: [{ sequence: 1, sexSpecific: 'M' }] }],
    ['W004', { lines: [{ ...base().lines[0], chargeAmount: 5001 }] }],
  ])('%s fires', (code, input) => expect(codes(input)).toContain(code));
  it('does not fire rules for valid data', () => expect(scrubClaim(base())).toEqual([]));
  it('skips insurance validation for self pay', () =>
    expect(codes({ payer: { planType: 'SELF_PAY' }, policy: null })).not.toContain('E002'));
  it('accepts valid modifier 25 and diagnosis pointers', () => {
    const input = base();
    input.lines.push({
      cptCode: '93000',
      modifiers: '',
      units: 1,
      chargeAmount: 50,
      diagnosisPointers: '1',
    });
    input.lines[0].modifiers = '25';
    expect(codes(input)).not.toContain('W002');
  });
});
