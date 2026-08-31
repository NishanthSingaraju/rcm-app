import { round2 } from './money';

export type AdjudicationInput = {
  claimNumber: string;
  submittedAt: Date | string;
  payer: { allowedRate: number; avgDaysToPay: number };
  policy?: { deductible: number; deductibleMet: number; copay: number; coinsuranceRate: number } | null;
  lines: Array<{ lineNumber: number; cptCode: string; chargeAmount: number; units: number; modifiers?: string; diagnosisPointers?: string }>;
};
export type AdjudicatedLine = AdjudicationInput['lines'][number] & {
  allowedAmount: number; paidAmount: number; adjustmentAmount: number; patientResponsibility: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'DENIED';
};
export type AdjudicationResult = {
  status: 'PAID' | 'PARTIALLY_PAID' | 'DENIED';
  lines: AdjudicatedLine[];
  totalCharge: number; totalAllowed: number; totalPaid: number; totalAdjustment: number;
  patientResponsibility: number; balance: number; paymentDate: Date;
  denial?: { carc: string; rarc?: string; reason: string; category: string };
};

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const denialTable = [
  ['CO-16', 'CODING', 'Missing information', 'N130'],
  ['CO-197', 'AUTHORIZATION', 'No authorization', 'N30'],
  ['CO-29', 'TIMELY_FILING', 'Timely filing limit exceeded', 'M76'],
  ['CO-27', 'ELIGIBILITY', 'Coverage terminated', 'N130'],
  ['CO-50', 'MEDICAL_NECESSITY', 'Not medically necessary', 'N30'],
  ['CO-18', 'DUPLICATE', 'Duplicate claim', 'M76'],
] as const;

export function adjudicateClaim(input: AdjudicationInput, seed: string | number = ''): AdjudicationResult {
  const totalCharge = round2(input.lines.reduce((sum, line) => sum + line.chargeAmount * line.units, 0));
  const roll = hashString(`${seed}:${input.claimNumber}`) % 100;
  const submittedAt = input.submittedAt instanceof Date ? input.submittedAt : new Date(input.submittedAt);
  const paymentDate = new Date(submittedAt.getTime() + input.payer.avgDaysToPay * 86400000);
  if (roll < 18) {
    const reason = denialTable[hashString(`${input.claimNumber}:${seed}:reason`) % denialTable.length];
    const lines = input.lines.map((line) => ({
      ...line, allowedAmount: 0, paidAmount: 0, adjustmentAmount: round2(line.chargeAmount * line.units),
      patientResponsibility: 0, status: 'DENIED' as const,
    }));
    return { status: 'DENIED', lines, totalCharge, totalAllowed: 0, totalPaid: 0, totalAdjustment: totalCharge,
      patientResponsibility: 0, balance: 0, paymentDate,
      denial: { carc: reason[0], category: reason[1], reason: reason[2], rarc: reason[3] } };
  }
  const policy = input.policy ?? { deductible: 0, deductibleMet: 0, copay: 0, coinsuranceRate: 0 };
  let remainingDeductible = Math.max(0, policy.deductible - policy.deductibleMet);
  let copayRemaining = policy.copay;
  const lines = input.lines.map((line) => {
    const charge = round2(line.chargeAmount * line.units);
    const allowedAmount = round2(charge * input.payer.allowedRate);
    const adjustmentAmount = round2(charge - allowedAmount);
    const deductible = Math.min(remainingDeductible, allowedAmount);
    remainingDeductible = round2(remainingDeductible - deductible);
    const copay = Math.min(copayRemaining, Math.max(0, allowedAmount - deductible));
    copayRemaining = round2(copayRemaining - copay);
    const coinsurance = round2(Math.max(0, allowedAmount - deductible - copay) * policy.coinsuranceRate);
    const patientResponsibility = round2(deductible + copay + coinsurance);
    return { ...line, allowedAmount, adjustmentAmount, patientResponsibility,
      paidAmount: round2(allowedAmount - patientResponsibility),
      status: patientResponsibility === 0 ? 'PAID' as const : 'PARTIALLY_PAID' as const };
  });
  const totalAllowed = round2(lines.reduce((s, l) => s + l.allowedAmount, 0));
  const totalPaid = round2(lines.reduce((s, l) => s + l.paidAmount, 0));
  const totalAdjustment = round2(lines.reduce((s, l) => s + l.adjustmentAmount, 0));
  const patientResponsibility = round2(lines.reduce((s, l) => s + l.patientResponsibility, 0));
  return { status: patientResponsibility === 0 ? 'PAID' : 'PARTIALLY_PAID', lines, totalCharge, totalAllowed,
    totalPaid, totalAdjustment, patientResponsibility, balance: patientResponsibility, paymentDate };
}
