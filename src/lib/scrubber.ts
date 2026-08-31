export type EditSeverity = 'ERROR' | 'WARNING';
export type ClaimEditResult = {
  code: string;
  severity: EditSeverity;
  field?: string;
  message: string;
};

export type ScrubInput = {
  patient: { dob?: Date | string | null; sex: string };
  payer: { planType: string };
  policy?: {
    effectiveFrom: Date | string;
    effectiveTo?: Date | string | null;
  } | null;
  dateOfService: Date | string;
  provider: { npi?: string | null };
  placeOfService?: string | null;
  diagnoses: Array<{ sequence: number; sexSpecific?: string }>;
  lines: Array<{
    cptCode?: string;
    modifiers?: string;
    units: number;
    chargeAmount: number;
    diagnosisPointers?: string | null;
    isEvalAndManagement?: boolean;
  }>;
  duplicateCptCodes?: string[];
  asOf?: Date | string;
};

const date = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export function scrubClaim(input: ScrubInput): ClaimEditResult[] {
  const edits: ClaimEditResult[] = [];
  const dos = date(input.dateOfService);
  const asOf = date(input.asOf ?? new Date());
  const add = (code: string, severity: EditSeverity, field: string | undefined, message: string) =>
    edits.push({ code, severity, ...(field ? { field } : {}), message });

  if (!input.patient.dob) add('E001', 'ERROR', 'patient.dob', 'Patient date of birth is missing.');
  if (input.payer.planType !== 'SELF_PAY') {
    const p = input.policy;
    const active =
      p && date(p.effectiveFrom) <= dos && (!p.effectiveTo || date(p.effectiveTo) >= dos);
    if (!active)
      add('E002', 'ERROR', 'policy', 'No active insurance policy covers the date of service.');
  }
  if (!input.diagnoses.some((dx) => dx.sequence === 1)) {
    add('E003', 'ERROR', 'diagnoses', 'A primary diagnosis with sequence 1 is required.');
  }
  const sequences = new Set(input.diagnoses.map((dx) => dx.sequence));
  input.lines.forEach((line, index) => {
    const pointers = (line.diagnosisPointers ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!pointers.length || pointers.some((p) => !sequences.has(Number(p)))) {
      add(
        'E004',
        'ERROR',
        `lines.${index}.diagnosisPointers`,
        'Diagnosis pointers must reference existing diagnosis sequences.',
      );
    }
    if (line.units < 1 || line.chargeAmount <= 0) {
      add(
        'E005',
        'ERROR',
        `lines.${index}`,
        'Units must be at least 1 and charge amount must be positive.',
      );
    }
  });
  if (!input.provider.npi || !/^\d{10}$/.test(input.provider.npi)) {
    add('E006', 'ERROR', 'provider.npi', 'Provider NPI must be exactly 10 digits.');
  }
  if (!input.placeOfService)
    add('E007', 'ERROR', 'placeOfService', 'Place of service is required.');
  if ((input.duplicateCptCodes ?? []).length) {
    add(
      'E008',
      'ERROR',
      'claim',
      'A non-draft claim already exists for this patient, date, and procedure.',
    );
  }
  const ageDays = Math.floor((asOf.getTime() - dos.getTime()) / 86400000);
  if (ageDays > 90) add('W001', 'WARNING', 'dateOfService', 'Claim is at risk for timely filing.');
  const has25 = input.lines.some((line) =>
    (line.modifiers ?? '')
      .split(',')
      .map((m) => m.trim())
      .includes('25'),
  );
  const hasEm = input.lines.some(
    (line) => line.isEvalAndManagement || /^99/.test(line.cptCode ?? ''),
  );
  if (has25 && (input.lines.length < 2 || !hasEm)) {
    add(
      'W002',
      'WARNING',
      'lines.modifiers',
      'Modifier 25 requires at least two lines including an E&M service.',
    );
  }
  if (
    input.diagnoses.some(
      (dx) =>
        dx.sexSpecific &&
        dx.sexSpecific !== 'ANY' &&
        dx.sexSpecific !== 'U' &&
        dx.sexSpecific !== input.patient.sex,
    )
  ) {
    add('W003', 'WARNING', 'diagnoses', 'A diagnosis has a sex-specific coding mismatch.');
  }
  if (input.lines.reduce((total, line) => total + line.chargeAmount * line.units, 0) > 5000) {
    add(
      'W004',
      'WARNING',
      'totalCharge',
      'Total charge exceeds $5,000 and requires high-dollar review.',
    );
  }
  return edits;
}
