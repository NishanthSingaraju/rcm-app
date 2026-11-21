import {
  PrismaClient,
  PlanType,
  Sex,
  SexSpecific,
  PolicyRank,
  EncounterStatus,
  ClaimStatus,
  ClaimLineStatus,
  DenialStatus,
} from '@prisma/client';
import { round2 } from '../src/lib/money';

const prisma = new PrismaClient();
const now = new Date();
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
  const payers: Array<{ id: string; allowedRate: number; avgDaysToPay: number }> = [];
  for (const [name, payerId, planType, allowedRate, avgDaysToPay] of payerDefs) {
    payers.push(
      await prisma.payer.create({ data: { name, payerId, planType, allowedRate, avgDaysToPay } }),
    );
  }
  const procedures = [
    ['99213', 'Established patient office visit, low complexity', 125, true],
    ['99214', 'Established patient office visit, moderate complexity', 185, true],
    ['99215', 'Established patient office visit, high complexity', 275, true],
    ['99203', 'New patient office visit, low complexity', 175, true],
    ['99204', 'New patient office visit, moderate complexity', 265, true],
    ['93000', 'Electrocardiogram', 85, false],
    ['71046', 'Chest x-ray, 2 views', 145, false],
    ['80053', 'Comprehensive metabolic panel', 110, false],
    ['85025', 'Complete blood count', 65, false],
    ['36415', 'Venipuncture', 25, false],
    ['20610', 'Major joint injection', 210, false],
    ['90471', 'Immunization administration', 55, false],
    ['97110', 'Therapeutic exercises', 95, false],
    ['45378', 'Diagnostic colonoscopy', 950, false],
    ['J0696', 'Ceftriaxone injection', 75, false],
    ['J3301', 'Triamcinolone injection', 60, false],
    ['11102', 'Tangential biopsy', 180, false],
    ['17000', 'Destruction of benign lesion', 140, false],
    ['87880', 'Rapid strep test', 35, false],
    ['81001', 'Urinalysis', 30, false],
    ['90834', 'Psychotherapy, 45 minutes', 145, false],
    ['92507', 'Speech therapy', 105, false],
    ['97140', 'Manual therapy', 90, false],
    ['97530', 'Therapeutic activities', 100, false],
    ['43239', 'Upper GI endoscopy biopsy', 800, false],
    ['76805', 'Obstetric ultrasound', 250, false],
    ['99285', 'Emergency department visit', 550, true],
    ['G2211', 'Complexity add-on', 25, false],
    ['99490', 'Chronic care management', 70, false],
  ] as const;
  const procRows = [];
  for (const [code, description, defaultCharge, isEvalAndManagement] of procedures) {
    procRows.push(
      await prisma.procedureCode.create({
        data: { code, description, defaultCharge, isEvalAndManagement },
      }),
    );
  }
  const diagnoses = [
    ['E11.9', 'Type 2 diabetes mellitus without complications', SexSpecific.ANY],
    ['I10', 'Essential hypertension', SexSpecific.ANY],
    ['J06.9', 'Acute upper respiratory infection', SexSpecific.ANY],
    ['M54.5', 'Low back pain', SexSpecific.ANY],
    ['Z00.00', 'General adult medical examination', SexSpecific.ANY],
    ['F41.1', 'Generalized anxiety disorder', SexSpecific.ANY],
    ['N39.0', 'Urinary tract infection', SexSpecific.F],
    ['O09.90', 'Supervision of high-risk pregnancy', SexSpecific.F],
    ['C61', 'Malignant neoplasm of prostate', SexSpecific.M],
    ['R51.9', 'Headache', SexSpecific.ANY],
    ['E78.5', 'Hyperlipidemia', SexSpecific.ANY],
    ['K21.9', 'Gastro-esophageal reflux disease', SexSpecific.ANY],
    ['J45.909', 'Unspecified asthma', SexSpecific.ANY],
    ['G43.909', 'Migraine', SexSpecific.ANY],
    ['L20.9', 'Atopic dermatitis', SexSpecific.ANY],
    ['M17.11', 'Unilateral primary osteoarthritis, right knee', SexSpecific.ANY],
    ['R10.9', 'Abdominal pain', SexSpecific.ANY],
    ['H52.4', 'Presbyopia', SexSpecific.ANY],
    ['N18.2', 'Chronic kidney disease, stage 2', SexSpecific.ANY],
    ['D64.9', 'Anemia, unspecified', SexSpecific.ANY],
    ['G47.33', 'Obstructive sleep apnea', SexSpecific.ANY],
    ['J18.9', 'Pneumonia', SexSpecific.ANY],
    ['S93.401A', 'Sprain of right ankle', SexSpecific.ANY],
    ['Z23', 'Encounter for immunization', SexSpecific.ANY],
    ['K52.9', 'Noninfective gastroenteritis', SexSpecific.ANY],
    ['R05.9', 'Cough', SexSpecific.ANY],
    ['M25.511', 'Pain in right shoulder', SexSpecific.ANY],
    ['Z12.11', 'Encounter for screening colonoscopy', SexSpecific.ANY],
    ['O80', 'Encounter for uncomplicated delivery', SexSpecific.F],
  ] as const;
  const dxRows = [];
  for (const [code, description, sexSpecific] of diagnoses) {
    dxRows.push(await prisma.diagnosisCode.create({ data: { code, description, sexSpecific } }));
  }
  const providers = [];
  for (let i = 0; i < 8; i++) {
    providers.push(
      await prisma.provider.create({
        data: {
          npi: `100000000${i}`,
          firstName: ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Jamie', 'Drew'][i],
          lastName: ['Reed', 'Patel', 'Nguyen', 'Brooks', 'Santos', 'Kim', 'Morris', 'Carter'][i],
          specialty: [
            'Family Medicine',
            'Internal Medicine',
            'Cardiology',
            'Orthopedics',
            'Pediatrics',
            'Behavioral Health',
            'OB/GYN',
            'Urgent Care',
          ][i],
        },
      }),
    );
  }
  const patients = [];
  for (let i = 0; i < 40; i++) {
    const sex = i % 3 === 0 ? Sex.F : i % 3 === 1 ? Sex.M : Sex.U;
    const patient = await prisma.patient.create({
      data: {
        mrn: `MRN-${String(i + 1).padStart(5, '0')}`,
        firstName: ['Avery', 'Blake', 'Cameron', 'Dakota', 'Emerson'][i % 5],
        lastName: ['Wilson', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Garcia', 'Lee'][
          i % 8
        ],
        dob: i === 1 ? null : new Date(`198${i % 10}-0${(i % 8) + 1}-15T00:00:00Z`),
        sex,
        phone: `555-010${String(i).padStart(2, '0')}`,
        city: 'Raleigh',
        state: 'NC',
        zip: '27601',
      },
    });
    patients.push(patient);
    const payer = payers[i % 6];
    await prisma.insurancePolicy.create({
      data: {
        patientId: patient.id,
        payerId: payer.id,
        memberId: `MEM-${String(i + 1).padStart(6, '0')}`,
        rank: PolicyRank.PRIMARY,
        effectiveFrom: day(365),
        effectiveTo: i === 3 ? day(100) : null,
        copay: 20 + (i % 3) * 10,
        deductible: 1000,
        deductibleMet: (i % 5) * 100,
        coinsuranceRate: 0.2,
      },
    });
  }
  const encounters = [];
  for (let i = 0; i < 120; i++) {
    const patient = patients[i % patients.length];
    const provider = providers[i % providers.length];
    const encounter = await prisma.encounter.create({
      data: {
        patientId: patient.id,
        providerId: provider.id,
        dateOfService: day(((i * 3) % 179) + 1),
        placeOfService: i % 17 === 0 ? null : i % 4 === 0 ? '22' : '11',
        status: i < 100 ? EncounterStatus.BILLED : EncounterStatus.CODED,
        notes: 'Synthetic demo encounter.',
      },
    });
    encounters.push(encounter);
    const dx = dxRows[(i * 2) % dxRows.length];
    await prisma.encounterDiagnosis.create({
      data: { encounterId: encounter.id, diagnosisCode: dx.code, sequence: 1 },
    });
    if (i % 4 === 0)
      await prisma.encounterDiagnosis.create({
        data: {
          encounterId: encounter.id,
          diagnosisCode: dxRows[(i * 2 + 1) % dxRows.length].code,
          sequence: 2,
        },
      });
    const first = procRows[i % procRows.length];
    await prisma.chargeLine.create({
      data: {
        encounterId: encounter.id,
        cptCode: first.code,
        modifiers: i % 11 === 0 ? '25' : '',
        units: 1,
        chargeAmount: first.defaultCharge,
        diagnosisPointers: '1',
      },
    });
    if (i % 3 === 0) {
      const second = procRows[(i + 5) % procRows.length];
      await prisma.chargeLine.create({
        data: {
          encounterId: encounter.id,
          cptCode: second.code,
          modifiers: '',
          units: 1,
          chargeAmount: second.defaultCharge,
          diagnosisPointers: '1',
        },
      });
    }
  }
  const denialReasons = [
    ['CO-16', 'CODING', 'Missing information', 'N130'],
    ['CO-197', 'AUTHORIZATION', 'No authorization', 'N30'],
    ['CO-29', 'TIMELY_FILING', 'Timely filing limit exceeded', 'M76'],
    ['CO-27', 'ELIGIBILITY', 'Coverage terminated', 'N130'],
    ['CO-50', 'MEDICAL_NECESSITY', 'Not medically necessary', 'N30'],
    ['CO-18', 'DUPLICATE', 'Duplicate claim', 'M76'],
  ] as const;
  const adjudicatedIndexes = Array.from({ length: 100 }, (_, i) => i).filter((i) => {
    if (i < 2) return false;
    const ageDays = ((i * 3) % 179) + 1;
    return ageDays > payers[i % 7].avgDaysToPay + 3;
  });
  const denialIndexes = new Set(
    Array.from(
      { length: 8 },
      (_, index) => adjudicatedIndexes[Math.floor((index * adjudicatedIndexes.length) / 8)],
    ),
  );
  const eligibleIndexes = adjudicatedIndexes.filter((i) => !denialIndexes.has(i));
  const appealedIndex = eligibleIndexes[eligibleIndexes.length - 1];
  const closedIndexes = new Set(eligibleIndexes.slice(-3, -1));
  const partialIndexes = new Set(
    eligibleIndexes.filter((i) => i !== appealedIndex && !closedIndexes.has(i)).slice(0, 10),
  );
  for (let i = 0; i < 100; i++) {
    const encounter = encounters[i];
    const patient = patients[i % patients.length];
    const policy = await prisma.insurancePolicy.findFirst({ where: { patientId: patient.id } });
    const payer = payers[i % 7];
    const charges = await prisma.chargeLine.findMany({
      where: { encounterId: encounter.id },
      orderBy: { id: 'asc' },
    });
    const totalCharge = charges.reduce((sum, line) => sum + line.chargeAmount * line.units, 0);
    const ageDays = ((i * 3) % 179) + 1;
    const payerResponseReceived = ageDays > payer.avgDaysToPay + 3;
    const status = denialIndexes.has(i)
      ? ClaimStatus.DENIED
      : i === 0
        ? ClaimStatus.DRAFT
        : i === 1
          ? ClaimStatus.READY
          : !payerResponseReceived
            ? ageDays <= 7
              ? ClaimStatus.SUBMITTED
              : ClaimStatus.ACCEPTED
            : partialIndexes.has(i)
              ? ClaimStatus.PARTIALLY_PAID
              : closedIndexes.has(i)
                ? ClaimStatus.CLOSED
                : i === appealedIndex
                  ? ClaimStatus.APPEALED
                  : ClaimStatus.PAID;
    const isDraftOrReady = status === ClaimStatus.DRAFT || status === ClaimStatus.READY;
    const isSubmitted = !isDraftOrReady;
    const isAdjudicated = (
      [
        ClaimStatus.PAID,
        ClaimStatus.PARTIALLY_PAID,
        ClaimStatus.DENIED,
        ClaimStatus.APPEALED,
        ClaimStatus.CLOSED,
      ] as ClaimStatus[]
    ).includes(status);
    const isDenied = status === ClaimStatus.DENIED;
    const isAppealed = status === ClaimStatus.APPEALED;
    const hasDenial = isDenied || isAppealed;
    const isWrittenOff = status === ClaimStatus.CLOSED;
    const billedAt = isSubmitted ? new Date(encounter.dateOfService.getTime() + 86400000) : null;
    const paymentDate = isAdjudicated
      ? new Date(
          Math.min(
            billedAt!.getTime() + payer.avgDaysToPay * 86400000,
            now.getTime() - ((i % 5) + 1) * 86400000,
          ),
        )
      : null;
    const createdAt = new Date(encounter.dateOfService.getTime() + 3600000);
    const allowed =
      isAdjudicated && !isDenied && !isWrittenOff ? totalCharge * payer.allowedRate : 0;
    const paid =
      status === ClaimStatus.PAID
        ? allowed * 0.85
        : isAppealed
          ? allowed
          : status === ClaimStatus.PARTIALLY_PAID
            ? allowed * 0.45
            : 0;
    const adjustment = isDenied
      ? 0
      : isWrittenOff
        ? totalCharge
        : isAdjudicated
          ? totalCharge - allowed
          : 0;
    const patientResponsibility = isAdjudicated && !isDenied && !isWrittenOff ? allowed - paid : 0;
    const balance = isDraftOrReady
      ? 0
      : isDenied
        ? totalCharge
        : isWrittenOff
          ? 0
          : isAdjudicated
            ? totalCharge - paid - adjustment
            : totalCharge;
    const claim = await prisma.claim.create({
      data: {
        claimNumber: `CLM-${String(i + 1).padStart(6, '0')}`,
        patientId: patient.id,
        encounterId: encounter.id,
        payerId: payer.id,
        policyId: policy?.id,
        status,
        totalCharge,
        totalAllowed: allowed,
        totalPaid: paid,
        totalAdjustment: adjustment,
        patientResponsibility,
        balance,
        billedAt,
        submittedAt: billedAt,
        cleanOnFirstPass: isDraftOrReady ? null : i % 9 !== 0,
        createdAt,
      },
    });
    const remittance = isAdjudicated
      ? await prisma.remittance.create({
          data: {
            checkNumber: `ERA-${payer.id}-${i}`,
            payerId: payer.id,
            paymentDate: paymentDate!,
            totalPaid: paid,
            postedAt: paymentDate,
          },
        })
      : null;
    for (let lineIndex = 0; lineIndex < charges.length; lineIndex++) {
      const charge = charges[lineIndex];
      const lineCharge = charge.chargeAmount * charge.units;
      const lineAllowed = allowed ? lineCharge * payer.allowedRate : 0;
      const linePaid = allowed ? lineAllowed * (paid / allowed) : 0;
      const lineAdjustment = isDenied
        ? 0
        : isWrittenOff
          ? lineCharge
          : isAdjudicated
            ? lineCharge - lineAllowed
            : 0;
      const line = await prisma.claimLine.create({
        data: {
          claimId: claim.id,
          lineNumber: lineIndex + 1,
          cptCode: charge.cptCode,
          modifiers: charge.modifiers,
          units: charge.units,
          chargeAmount: lineCharge,
          allowedAmount: lineAllowed,
          paidAmount: linePaid,
          adjustmentAmount: lineAdjustment,
          patientResponsibility:
            isAdjudicated && !isDenied && !isWrittenOff ? lineAllowed - linePaid : 0,
          diagnosisPointers: charge.diagnosisPointers,
          status: isDenied
            ? ClaimLineStatus.DENIED
            : paid > 0
              ? ClaimLineStatus.PAID
              : ClaimLineStatus.OPEN,
        },
      });
      if (remittance)
        await prisma.remittanceLine.create({
          data: {
            remittanceId: remittance.id,
            claimId: claim.id,
            claimLineId: line.id,
            allowedAmount: lineAllowed,
            paidAmount: linePaid,
            adjustmentAmount: lineAdjustment,
            patientResponsibility:
              isAdjudicated && !isDenied && !isWrittenOff ? lineAllowed - linePaid : 0,
            carc: isDenied ? denialReasons[i % denialReasons.length][0] : null,
            rarc: isDenied ? denialReasons[i % denialReasons.length][3] : null,
          },
        });
    }
    await prisma.claimEvent.create({
      data: {
        claimId: claim.id,
        type: 'CREATED',
        description: 'Claim created from encounter.',
        createdAt,
      },
    });
    if (isSubmitted)
      await prisma.claimEvent.create({
        data: {
          claimId: claim.id,
          type: 'SUBMITTED',
          description: 'Claim submitted to payer.',
          createdAt: billedAt!,
        },
      });
    if (status === ClaimStatus.PAID || status === ClaimStatus.PARTIALLY_PAID || isAppealed)
      await prisma.claimEvent.create({
        data: {
          claimId: claim.id,
          type: 'PAYMENT_POSTED',
          description: 'Payer response adjudicated and payment posted.',
          createdAt: paymentDate!,
        },
      });
    if (hasDenial || isWrittenOff) {
      const reason = denialReasons[i % denialReasons.length];
      if (hasDenial)
        await prisma.claimEvent.create({
          data: {
            claimId: claim.id,
            type: 'DENIED',
            description: `Claim denied: ${reason[2]}.`,
            createdAt: paymentDate!,
          },
        });
      if (isAppealed)
        await prisma.claimEvent.create({
          data: {
            claimId: claim.id,
            type: 'APPEALED',
            description: 'Denial appealed and resolved in the patient’s favor.',
            createdAt: new Date(paymentDate!.getTime() + 86400000),
          },
        });
      await prisma.denial.create({
        data: {
          claimId: claim.id,
          carc: reason[0],
          rarc: reason[3],
          reason: reason[2],
          category: reason[1],
          status:
            status === ClaimStatus.APPEALED
              ? DenialStatus.RESOLVED
              : isWrittenOff
                ? DenialStatus.WRITTEN_OFF
                : DenialStatus.OPEN,
          notes: 'Synthetic denial for demonstration.',
          createdAt: paymentDate!,
        },
      });
    }
    if (isWrittenOff)
      await prisma.claimEvent.create({
        data: {
          claimId: claim.id,
          type: 'WRITTEN_OFF',
          description: 'Remaining denial balance written off.',
          createdAt: new Date(paymentDate!.getTime() + 86400000),
        },
      });
  }
  const partialClaims = await prisma.claim.findMany({
    where: { status: { in: [ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID] } },
    orderBy: { claimNumber: 'asc' },
    select: {
      id: true,
      claimNumber: true,
      patientResponsibility: true,
      balance: true,
      events: true,
    },
  });
  for (const claim of partialClaims) {
    const claimSequence = Number(claim.claimNumber.slice(-6));
    if (claimSequence % 9 === 0 || claimSequence === 80) continue;
    const payerPayment = claim.events.find((event) => event.type === 'PAYMENT_POSTED');
    const paymentDate = payerPayment
      ? new Date(
          Math.min(payerPayment.createdAt.getTime() + 2 * 86400000, now.getTime() - 86400000),
        )
      : new Date(now.getTime() - 86400000);
    const payment = round2(Math.min(claim.patientResponsibility * 0.95, claim.balance));
    if (payment <= 0) continue;
    await prisma.claim.update({
      where: { id: claim.id },
      data: {
        balance: { decrement: payment },
        totalPaid: { increment: payment },
        patientResponsibility: { decrement: payment },
        events: {
          create: {
            type: 'PAYMENT_POSTED',
            description: `Patient payment of $${payment.toFixed(2)} posted.`,
            createdAt: paymentDate,
          },
        },
      },
    });
  }
  console.log(
    `Seeded ${payers.length} payers, ${patients.length} patients, ${encounters.length} encounters, and 100 claims.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
