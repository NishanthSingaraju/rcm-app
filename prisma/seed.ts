import { PrismaClient, PlanType, Sex, SexSpecific, PolicyRank, EncounterStatus, ClaimStatus, ClaimLineStatus, DenialCategory, DenialStatus } from '@prisma/client';

const prisma = new PrismaClient();
const now = new Date('2025-02-01T12:00:00.000Z');
const day = (n: number) => new Date(now.getTime() - n * 86400000);

async function main() {
  await prisma.remittanceLine.deleteMany();
  await prisma.remittance.deleteMany();
  await prisma.denial.deleteMany();
  await prisma.claimEvent.deleteMany();
  await prisma.claimEdit.deleteMany();
  await prisma.claimLine.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.chargeLine.deleteMany();
  await prisma.encounterDiagnosis.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.procedureCode.deleteMany();
  await prisma.diagnosisCode.deleteMany();
  await prisma.payer.deleteMany();

  const payerDefs = [
    ['Aetna', 'AETNA', PlanType.COMMERCIAL, 0.62, 24],
    ['Blue Cross Blue Shield', 'BCBS', PlanType.COMMERCIAL, 0.68, 28],
    ['Cigna', 'CIGNA', PlanType.COMMERCIAL, 0.59, 31],
    ['UnitedHealthcare', 'UHC', PlanType.COMMERCIAL, 0.65, 26],
    ['Medicare', 'MEDICARE', PlanType.MEDICARE, 0.72, 21],
    ['Medicaid', 'MEDICAID', PlanType.MEDICAID, 0.54, 35],
    ['Self Pay', 'SELF', PlanType.SELF_PAY, 1, 7],
  ] as const;
  const payers = [];
  for (const [name, payerId, planType, allowedRate, avgDaysToPay] of payerDefs) {
    payers.push(await prisma.payer.create({ data: { name, payerId, planType, allowedRate, avgDaysToPay } }));
  }
  const procedures = [
    ['99213', 'Established patient office visit, low complexity', 125, true], ['99214', 'Established patient office visit, moderate complexity', 185, true],
    ['99215', 'Established patient office visit, high complexity', 275, true], ['99203', 'New patient office visit, low complexity', 175, true],
    ['99204', 'New patient office visit, moderate complexity', 265, true], ['93000', 'Electrocardiogram', 85, false], ['71046', 'Chest x-ray, 2 views', 145, false],
    ['80053', 'Comprehensive metabolic panel', 110, false], ['85025', 'Complete blood count', 65, false], ['36415', 'Venipuncture', 25, false],
    ['20610', 'Major joint injection', 210, false], ['90471', 'Immunization administration', 55, false], ['97110', 'Therapeutic exercises', 95, false],
    ['45378', 'Diagnostic colonoscopy', 950, false], ['J0696', 'Ceftriaxone injection', 75, false], ['J3301', 'Triamcinolone injection', 60, false],
    ['11102', 'Tangential biopsy', 180, false], ['17000', 'Destruction of benign lesion', 140, false], ['87880', 'Rapid strep test', 35, false],
    ['81001', 'Urinalysis', 30, false], ['90834', 'Psychotherapy, 45 minutes', 145, false], ['92507', 'Speech therapy', 105, false],
    ['97140', 'Manual therapy', 90, false], ['97530', 'Therapeutic activities', 100, false], ['43239', 'Upper GI endoscopy biopsy', 800, false],
    ['76805', 'Obstetric ultrasound', 250, false], ['99285', 'Emergency department visit', 550, true], ['G2211', 'Complexity add-on', 25, false],
    ['99490', 'Chronic care management', 70, false],
  ] as const;
  const procRows = [];
  for (const [code, description, defaultCharge, isEvalAndManagement] of procedures) {
    procRows.push(await prisma.procedureCode.create({ data: { code, description, defaultCharge, isEvalAndManagement } }));
  }
  const diagnoses = [
    ['E11.9', 'Type 2 diabetes mellitus without complications', SexSpecific.ANY], ['I10', 'Essential hypertension', SexSpecific.ANY],
    ['J06.9', 'Acute upper respiratory infection', SexSpecific.ANY], ['M54.5', 'Low back pain', SexSpecific.ANY],
    ['Z00.00', 'General adult medical examination', SexSpecific.ANY], ['F41.1', 'Generalized anxiety disorder', SexSpecific.ANY],
    ['N39.0', 'Urinary tract infection', SexSpecific.F], ['O09.90', 'Supervision of high-risk pregnancy', SexSpecific.F],
    ['C61', 'Malignant neoplasm of prostate', SexSpecific.M], ['R51.9', 'Headache', SexSpecific.ANY],
    ['E78.5', 'Hyperlipidemia', SexSpecific.ANY], ['K21.9', 'Gastro-esophageal reflux disease', SexSpecific.ANY],
    ['J45.909', 'Unspecified asthma', SexSpecific.ANY], ['G43.909', 'Migraine', SexSpecific.ANY], ['L20.9', 'Atopic dermatitis', SexSpecific.ANY],
    ['M17.11', 'Unilateral primary osteoarthritis, right knee', SexSpecific.ANY], ['R10.9', 'Abdominal pain', SexSpecific.ANY],
    ['H52.4', 'Presbyopia', SexSpecific.ANY], ['N18.2', 'Chronic kidney disease, stage 2', SexSpecific.ANY],
    ['D64.9', 'Anemia, unspecified', SexSpecific.ANY], ['G47.33', 'Obstructive sleep apnea', SexSpecific.ANY],
    ['J18.9', 'Pneumonia', SexSpecific.ANY], ['S93.401A', 'Sprain of right ankle', SexSpecific.ANY],
    ['Z23', 'Encounter for immunization', SexSpecific.ANY], ['K52.9', 'Noninfective gastroenteritis', SexSpecific.ANY],
    ['R05.9', 'Cough', SexSpecific.ANY], ['M25.511', 'Pain in right shoulder', SexSpecific.ANY],
    ['Z12.11', 'Encounter for screening colonoscopy', SexSpecific.ANY], ['O80', 'Encounter for uncomplicated delivery', SexSpecific.F],
  ] as const;
  const dxRows = [];
  for (const [code, description, sexSpecific] of diagnoses) {
    dxRows.push(await prisma.diagnosisCode.create({ data: { code, description, sexSpecific } }));
  }
  const providers = [];
  for (let i = 0; i < 8; i++) {
    providers.push(await prisma.provider.create({ data: {
      npi: `100000000${i}`, firstName: ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Jamie', 'Drew'][i],
      lastName: ['Reed', 'Patel', 'Nguyen', 'Brooks', 'Santos', 'Kim', 'Morris', 'Carter'][i],
      specialty: ['Family Medicine', 'Internal Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Behavioral Health', 'OB/GYN', 'Urgent Care'][i],
    } }));
  }
  const patients = [];
  for (let i = 0; i < 40; i++) {
    const sex = i % 3 === 0 ? Sex.F : i % 3 === 1 ? Sex.M : Sex.U;
    const patient = await prisma.patient.create({ data: {
      mrn: `MRN-${String(i + 1).padStart(5, '0')}`, firstName: ['Avery', 'Blake', 'Cameron', 'Dakota', 'Emerson'][i % 5],
      lastName: ['Wilson', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Garcia', 'Lee'][i % 8],
      dob: i === 1 ? null : new Date(`198${i % 10}-0${(i % 8) + 1}-15T00:00:00Z`), sex, phone: `555-010${String(i).padStart(2, '0')}`,
      city: 'Raleigh', state: 'NC', zip: '27601',
    } });
    patients.push(patient);
    const payer = payers[i % 6];
    await prisma.insurancePolicy.create({ data: {
      patientId: patient.id, payerId: payer.id, memberId: `MEM-${String(i + 1).padStart(6, '0')}`, rank: PolicyRank.PRIMARY,
      effectiveFrom: day(365), effectiveTo: i === 3 ? day(100) : null, copay: 20 + (i % 3) * 10,
      deductible: 1000, deductibleMet: (i % 5) * 100, coinsuranceRate: 0.2,
    } });
  }
  const encounters = [];
  for (let i = 0; i < 120; i++) {
    const patient = patients[i % patients.length];
    const provider = providers[i % providers.length];
    const encounter = await prisma.encounter.create({ data: {
      patientId: patient.id, providerId: provider.id, dateOfService: day((i * 3) % 180),
      placeOfService: i % 17 === 0 ? null : i % 4 === 0 ? '22' : '11',
      status: i < 100 ? EncounterStatus.BILLED : EncounterStatus.CODED, notes: 'Synthetic demo encounter.',
    } });
    encounters.push(encounter);
    const dx = dxRows[(i * 2) % dxRows.length];
    await prisma.encounterDiagnosis.create({ data: { encounterId: encounter.id, diagnosisCode: dx.code, sequence: 1 } });
    if (i % 4 === 0) await prisma.encounterDiagnosis.create({ data: { encounterId: encounter.id, diagnosisCode: dxRows[(i * 2 + 1) % dxRows.length].code, sequence: 2 } });
    const first = procRows[i % procRows.length];
    await prisma.chargeLine.create({ data: { encounterId: encounter.id, cptCode: first.code, modifiers: i % 11 === 0 ? '25' : '', units: 1, chargeAmount: first.defaultCharge, diagnosisPointers: '1' } });
    if (i % 3 === 0) {
      const second = procRows[(i + 5) % procRows.length];
      await prisma.chargeLine.create({ data: { encounterId: encounter.id, cptCode: second.code, modifiers: '', units: 1, chargeAmount: second.defaultCharge, diagnosisPointers: '1' } });
    }
  }
  const statuses: ClaimStatus[] = [ClaimStatus.DRAFT, ClaimStatus.READY, ClaimStatus.SUBMITTED, ClaimStatus.ACCEPTED, ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID, ClaimStatus.DENIED, ClaimStatus.APPEALED, ClaimStatus.CLOSED];
  for (let i = 0; i < 100; i++) {
    const encounter = encounters[i];
    const patient = patients[i % patients.length];
    const policy = await prisma.insurancePolicy.findFirst({ where: { patientId: patient.id } });
    const payer = payers[i % 7];
    const charges = await prisma.chargeLine.findMany({ where: { encounterId: encounter.id }, orderBy: { id: 'asc' } });
    const totalCharge = charges.reduce((s, l) => s + l.chargeAmount * l.units, 0);
    const status = i < 5 ? ClaimStatus.DRAFT : statuses[1 + (i % (statuses.length - 1))];
    const rate = payer.allowedRate;
    const allowed = status === ClaimStatus.DRAFT || status === ClaimStatus.DENIED ? 0 : totalCharge * rate;
    const paid = ([ClaimStatus.PAID, ClaimStatus.ACCEPTED, ClaimStatus.CLOSED] as string[]).includes(status) ? allowed * 0.8 : status === ClaimStatus.PARTIALLY_PAID || status === ClaimStatus.APPEALED ? allowed * 0.45 : 0;
    const adjustment = status === ClaimStatus.DENIED ? totalCharge : totalCharge - allowed;
    const patientResp = status === ClaimStatus.DENIED ? 0 : Math.max(0, allowed - paid);
    const claim = await prisma.claim.create({ data: {
      claimNumber: `CLM-${String(i + 1).padStart(6, '0')}`, patientId: patient.id, encounterId: encounter.id, payerId: payer.id,
      policyId: policy?.id, status, totalCharge, totalAllowed: allowed, totalPaid: paid, totalAdjustment: adjustment,
      patientResponsibility: patientResp, balance: status === ClaimStatus.DENIED ? 0 : totalCharge - paid - adjustment,
      billedAt: day((i * 3) % 180), submittedAt: day((i * 3) % 180 - 1), cleanOnFirstPass: i % 9 !== 0,
    } });
    const remittance = ([ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID, ClaimStatus.DENIED, ClaimStatus.ACCEPTED, ClaimStatus.APPEALED, ClaimStatus.CLOSED] as string[]).includes(status)
      ? await prisma.remittance.upsert({ where: { checkNumber: `ERA-${payer.id}-${i}` }, update: {}, create: { checkNumber: `ERA-${payer.id}-${i}`, payerId: payer.id, paymentDate: day((i * 3) % 180 - payer.avgDaysToPay), totalPaid: paid, postedAt: day((i * 3) % 180 - payer.avgDaysToPay) } }) : null;
    for (let lineIndex = 0; lineIndex < charges.length; lineIndex++) {
      const charge = charges[lineIndex];
      const lineAllowed = status === ClaimStatus.DRAFT || status === ClaimStatus.DENIED ? 0 : charge.chargeAmount * rate;
      const linePaid = lineAllowed * (paid && allowed ? paid / allowed : 0);
      const line = await prisma.claimLine.create({ data: {
        claimId: claim.id, lineNumber: lineIndex + 1, cptCode: charge.cptCode, modifiers: charge.modifiers, units: charge.units,
        chargeAmount: charge.chargeAmount * charge.units, allowedAmount: lineAllowed, paidAmount: linePaid,
        adjustmentAmount: status === ClaimStatus.DENIED ? charge.chargeAmount : charge.chargeAmount - lineAllowed,
        patientResponsibility: Math.max(0, lineAllowed - linePaid), diagnosisPointers: charge.diagnosisPointers,
        status: status === ClaimStatus.DENIED ? ClaimLineStatus.DENIED : paid > 0 ? ClaimLineStatus.PAID : ClaimLineStatus.OPEN,
      } });
      if (remittance) await prisma.remittanceLine.create({ data: { remittanceId: remittance.id, claimId: claim.id, claimLineId: line.id, allowedAmount: lineAllowed, paidAmount: linePaid, adjustmentAmount: charge.chargeAmount - lineAllowed, patientResponsibility: Math.max(0, lineAllowed - linePaid), carc: status === ClaimStatus.DENIED ? 'CO-16' : null } });
    }
    await prisma.claimEvent.create({ data: { claimId: claim.id, type: 'CREATED', description: 'Claim created from encounter.' } });
    if (status !== ClaimStatus.DRAFT) await prisma.claimEvent.create({ data: { claimId: claim.id, type: 'SUBMITTED', description: 'Claim submitted to payer.' } });
    if (status === ClaimStatus.DENIED || status === ClaimStatus.APPEALED || status === ClaimStatus.CLOSED) {
      await prisma.denial.create({ data: { claimId: claim.id, carc: 'CO-16', rarc: 'N130', reason: 'Missing information', category: DenialCategory.CODING, status: status === ClaimStatus.APPEALED ? DenialStatus.APPEALED : status === ClaimStatus.CLOSED ? DenialStatus.WRITTEN_OFF : DenialStatus.OPEN, notes: 'Synthetic denial for demonstration.' } });
    }
  }
  console.log(`Seeded ${payers.length} payers, ${patients.length} patients, ${encounters.length} encounters, and 100 claims.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
