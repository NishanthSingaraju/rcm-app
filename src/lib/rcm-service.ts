import { ClaimStatus, ClaimLineStatus, DenialStatus, EditSeverity } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { adjudicateClaim } from './adjudicate';
import { scrubClaim as runScrubber } from './scrubber';
import { round2 } from './money';
import { prisma } from './prisma';

const claimInclude = {
  patient: true,
  payer: true,
  policy: true,
  encounter: { include: { provider: true, diagnoses: { include: { diagnosis: true } } } },
  lines: true,
  edits: true,
  events: { orderBy: { createdAt: 'desc' as const } },
  denials: true,
  remittanceLines: { include: { remittance: true } },
};

async function claimForScrub(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      patient: true,
      payer: true,
      policy: true,
      encounter: { include: { provider: true, diagnoses: { include: { diagnosis: true } } } },
      lines: true,
    },
  });
  if (!claim) throw new Error('Claim not found.');
  return claim;
}

async function scrubData(claim: Awaited<ReturnType<typeof claimForScrub>>) {
  const cpts = claim.lines.map((line) => line.cptCode);
  const duplicates = await prisma.claim.findMany({
    where: {
      id: { not: claim.id },
      patientId: claim.patientId,
      status: { not: ClaimStatus.DRAFT },
      encounter: { dateOfService: claim.encounter.dateOfService },
      lines: { some: { cptCode: { in: cpts } } },
    },
    select: { lines: { select: { cptCode: true } } },
  });
  const duplicateCptCodes = duplicates.flatMap((d) => d.lines.map((line) => line.cptCode));
  return runScrubber({
    patient: claim.patient,
    payer: claim.payer,
    policy: claim.policy,
    dateOfService: claim.encounter.dateOfService,
    provider: claim.encounter.provider,
    placeOfService: claim.encounter.placeOfService,
    diagnoses: claim.encounter.diagnoses.map((dx) => ({
      sequence: dx.sequence,
      sexSpecific: dx.diagnosis.sexSpecific,
    })),
    lines: claim.lines.map((line) => ({ ...line, isEvalAndManagement: /^99/.test(line.cptCode) })),
    duplicateCptCodes,
    asOf: new Date(),
  });
}

export async function scrubClaim(claimId: string) {
  const claim = await claimForScrub(claimId);
  const edits = await scrubData(claim);
  await prisma.$transaction(async (tx) => {
    await tx.claimEdit.deleteMany({ where: { claimId } });
    if (edits.length)
      await tx.claimEdit.createMany({
        data: edits.map((edit) => ({
          claimId,
          severity: edit.severity as EditSeverity,
          code: edit.code,
          field: edit.field,
          message: edit.message,
        })),
      });
    await tx.claim.update({
      where: { id: claimId },
      data: {
        lastScrubbedAt: new Date(),
        status: edits.some((e) => e.severity === 'ERROR')
          ? undefined
          : claim.status === ClaimStatus.DRAFT
            ? ClaimStatus.READY
            : claim.status,
      },
    });
    await tx.claimEvent.create({
      data: {
        claimId,
        type: 'SCRUBBED',
        description: edits.length
          ? `Scrubber found ${edits.length} edit(s).`
          : 'Claim passed the scrubber with no errors.',
      },
    });
  });
  revalidatePath('/');
  revalidatePath('/claims');
  revalidatePath(`/claims/${claimId}`);
  return prisma.claim.findUniqueOrThrow({ where: { id: claimId }, include: claimInclude });
}

export async function createClaimFromEncounter(encounterId: string) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      patient: { include: { policies: { include: { payer: true } } } },
      chargeLines: true,
      diagnoses: { include: { diagnosis: true } },
      provider: true,
    },
  });
  if (!encounter) throw new Error('Encounter not found.');
  if (!encounter.chargeLines.length) throw new Error('Cannot create a claim without charge lines.');
  if (encounter.status === 'BILLED') throw new Error('Encounter has already been billed.');
  const policy =
    encounter.patient.policies.find((p) => p.rank === 'PRIMARY') ?? encounter.patient.policies[0];
  const payer =
    policy?.payer ?? (await prisma.payer.findFirstOrThrow({ where: { planType: 'SELF_PAY' } }));
  const last = await prisma.claim.findFirst({
    orderBy: { claimNumber: 'desc' },
    select: { claimNumber: true },
  });
  const next = (last ? Number(last.claimNumber.replace(/\D/g, '')) : 0) + 1;
  const totalCharge = round2(
    encounter.chargeLines.reduce((s, l) => s + l.chargeAmount * l.units, 0),
  );
  const claim = await prisma.claim.create({
    data: {
      claimNumber: `CLM-${String(next).padStart(6, '0')}`,
      patientId: encounter.patientId,
      encounterId,
      payerId: payer.id,
      policyId: policy?.id,
      status: ClaimStatus.DRAFT,
      totalCharge,
      totalAllowed: 0,
      totalPaid: 0,
      totalAdjustment: 0,
      patientResponsibility: 0,
      balance: totalCharge,
      lines: {
        create: encounter.chargeLines.map((line, i) => ({
          lineNumber: i + 1,
          cptCode: line.cptCode,
          modifiers: line.modifiers,
          units: line.units,
          chargeAmount: round2(line.chargeAmount * line.units),
          allowedAmount: 0,
          paidAmount: 0,
          adjustmentAmount: 0,
          patientResponsibility: 0,
          diagnosisPointers: line.diagnosisPointers,
          status: ClaimLineStatus.OPEN,
        })),
      },
      events: { create: { type: 'CREATED', description: 'Claim created from encounter.' } },
    },
    include: claimInclude,
  });
  await prisma.encounter.update({ where: { id: encounterId }, data: { status: 'BILLED' } });
  const scrubbed = await scrubClaim(claim.id);
  await prisma.claim.update({
    where: { id: claim.id },
    data: { cleanOnFirstPass: scrubbed.edits.every((e) => e.severity !== EditSeverity.ERROR) },
  });
  revalidatePath('/encounters');
  revalidatePath('/claims');
  return prisma.claim.findUniqueOrThrow({ where: { id: claim.id }, include: claimInclude });
}

export async function submitClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { edits: true } });
  if (!claim) throw new Error('Claim not found.');
  if (!([ClaimStatus.READY, ClaimStatus.DRAFT] as string[]).includes(claim.status))
    throw new Error('Only draft or ready claims can be submitted.');
  if (claim.edits.some((edit) => edit.severity === EditSeverity.ERROR))
    throw new Error('Claim has scrubber errors and cannot be submitted.');
  const submittedAt = new Date();
  const result = await prisma.claim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.SUBMITTED,
      submittedAt,
      billedAt: claim.billedAt ?? submittedAt,
      events: { create: { type: 'SUBMITTED', description: 'Claim submitted to payer.' } },
    },
    include: claimInclude,
  });
  revalidatePath('/');
  revalidatePath('/claims');
  revalidatePath(`/claims/${claimId}`);
  return result;
}

export async function adjudicateAndPost(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { payer: true, policy: true, lines: true },
  });
  if (!claim) throw new Error('Claim not found.');
  if (claim.status !== ClaimStatus.SUBMITTED)
    throw new Error('Only submitted claims can be adjudicated.');
  const result = adjudicateClaim(
    {
      claimNumber: claim.claimNumber,
      submittedAt: claim.submittedAt ?? new Date(),
      payer: claim.payer,
      policy: claim.policy,
      lines: claim.lines,
    },
    'rcm-demo',
  );
  const checkNumber = `ERA-${claim.payerId}-${result.paymentDate.toISOString().slice(0, 10)}`;
  await prisma.$transaction(async (tx) => {
    const remit = await tx.remittance.upsert({
      where: { checkNumber },
      update: { totalPaid: { increment: result.totalPaid } },
      create: {
        checkNumber,
        payerId: claim.payerId,
        paymentDate: result.paymentDate,
        totalPaid: result.totalPaid,
        postedAt: new Date(),
      },
    });
    for (const line of result.lines) {
      await tx.claimLine.update({
        where: { id: claim.lines.find((l) => l.lineNumber === line.lineNumber)!.id },
        data: {
          allowedAmount: line.allowedAmount,
          paidAmount: line.paidAmount,
          adjustmentAmount: line.adjustmentAmount,
          patientResponsibility: line.patientResponsibility,
          status:
            line.status === 'DENIED'
              ? ClaimLineStatus.DENIED
              : line.status === 'PAID'
                ? ClaimLineStatus.PAID
                : ClaimLineStatus.OPEN,
        },
      });
      await tx.remittanceLine.create({
        data: {
          remittanceId: remit.id,
          claimId,
          claimLineId: claim.lines.find((l) => l.lineNumber === line.lineNumber)!.id,
          allowedAmount: line.allowedAmount,
          paidAmount: line.paidAmount,
          adjustmentAmount: line.adjustmentAmount,
          patientResponsibility: line.patientResponsibility,
          carc: result.denial?.carc,
          rarc: result.denial?.rarc,
        },
      });
    }
    await tx.claim.update({
      where: { id: claimId },
      data: {
        status: result.status,
        totalAllowed: result.totalAllowed,
        totalPaid: result.totalPaid,
        totalAdjustment: result.totalAdjustment,
        patientResponsibility: result.patientResponsibility,
        balance: round2(claim.totalCharge - result.totalPaid - result.totalAdjustment),
        events: {
          create: {
            type: result.status === ClaimStatus.DENIED ? 'DENIED' : 'PAYMENT_POSTED',
            description:
              result.status === 'DENIED'
                ? `Claim denied: ${result.denial?.reason}.`
                : 'Payer response adjudicated and payment posted.',
          },
        },
      },
    });
    if (result.denial)
      await tx.denial.create({
        data: {
          claimId,
          carc: result.denial.carc,
          rarc: result.denial.rarc,
          reason: result.denial.reason,
          category: result.denial.category as never,
          status: DenialStatus.OPEN,
        },
      });
  });
  revalidatePath('/');
  revalidatePath('/claims');
  revalidatePath('/denials');
  revalidatePath('/remittances');
  revalidatePath(`/claims/${claimId}`);
  return prisma.claim.findUniqueOrThrow({ where: { id: claimId }, include: claimInclude });
}

export async function appealDenial(denialId: string, notes?: string) {
  const denial = await prisma.denial.findUnique({ where: { id: denialId } });
  if (!denial) throw new Error('Denial not found.');
  if (([DenialStatus.WRITTEN_OFF, DenialStatus.RESOLVED] as string[]).includes(denial.status))
    throw new Error('This denial is no longer appealable.');
  await prisma.$transaction([
    prisma.denial.update({
      where: { id: denialId },
      data: { status: DenialStatus.APPEALED, notes },
    }),
    prisma.claim.update({
      where: { id: denial.claimId },
      data: {
        status: ClaimStatus.APPEALED,
        events: { create: { type: 'APPEALED', description: 'Denial appealed for review.' } },
      },
    }),
  ]);
  revalidatePath('/denials');
  revalidatePath(`/claims/${denial.claimId}`);
  return prisma.denial.findUniqueOrThrow({ where: { id: denialId } });
}

export async function writeOffDenial(denialId: string) {
  const denial = await prisma.denial.findUnique({
    where: { id: denialId },
    include: { claim: true },
  });
  if (!denial) throw new Error('Denial not found.');
  if (denial.status === DenialStatus.WRITTEN_OFF) throw new Error('Denial is already written off.');
  await prisma.$transaction([
    prisma.denial.update({ where: { id: denialId }, data: { status: DenialStatus.WRITTEN_OFF } }),
    prisma.claim.update({
      where: { id: denial.claimId },
      data: {
        status: ClaimStatus.CLOSED,
        totalAdjustment: { increment: denial.claim.balance },
        balance: 0,
        events: {
          create: { type: 'WRITTEN_OFF', description: 'Remaining denial balance written off.' },
        },
      },
    }),
  ]);
  revalidatePath('/');
  revalidatePath('/denials');
  revalidatePath(`/claims/${denial.claimId}`);
  return prisma.denial.findUniqueOrThrow({ where: { id: denialId } });
}

export async function postPatientPayment(claimId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Payment amount must be greater than zero.');
  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new Error('Claim not found.');
  if (claim.balance <= 0) throw new Error('Claim has no outstanding balance.');
  const payment = round2(Math.min(amount, claim.balance));
  const result = await prisma.claim.update({
    where: { id: claimId },
    data: {
      balance: { decrement: payment },
      patientResponsibility: { decrement: Math.min(payment, claim.patientResponsibility) },
      events: {
        create: {
          type: 'PAYMENT_POSTED',
          description: `Patient payment of $${payment.toFixed(2)} posted.`,
        },
      },
    },
    include: claimInclude,
  });
  revalidatePath('/');
  revalidatePath('/claims');
  revalidatePath(`/claims/${claimId}`);
  return result;
}

export async function addEncounterCharge(
  encounterId: string,
  input: {
    cptCode: string;
    modifiers?: string;
    units: number;
    chargeAmount: number;
    diagnosisPointers: string;
  },
) {
  const result = await prisma.chargeLine.create({
    data: {
      encounterId,
      cptCode: input.cptCode,
      modifiers: input.modifiers ?? '',
      units: input.units,
      chargeAmount: input.chargeAmount,
      diagnosisPointers: input.diagnosisPointers,
    },
  });
  revalidatePath(`/encounters/${encounterId}`);
  return result;
}
export async function removeEncounterCharge(id: string) {
  return prisma.chargeLine.delete({ where: { id } });
}
export async function addEncounterDiagnosis(
  encounterId: string,
  diagnosisCode: string,
  sequence: number,
) {
  return prisma.encounterDiagnosis.create({ data: { encounterId, diagnosisCode, sequence } });
}
export async function removeEncounterDiagnosis(id: string) {
  return prisma.encounterDiagnosis.delete({ where: { id } });
}
