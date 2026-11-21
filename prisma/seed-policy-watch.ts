import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { heuristicSummarizer } from '../src/lib/policy-ai';
import { buildDailyDigest, importChargemaster, recordSnapshot } from '../src/lib/policy-service';

const now = new Date();
const daysAgo = (n: number, hour = 6) => {
  const date = new Date(now.getTime() - n * 86400000);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

type SourceDef = {
  payerId: string;
  name: string;
  url: string;
  description: string;
  baseline: string[];
  revisions?: { daysAgo: number; lines: string[] }[];
};

const page = (title: string, lines: string[]) =>
  `<html><head><title>${title}</title></head><body><header><nav>Providers | Policies | Sign in</nav></header><main>` +
  lines.map((line) => `<p>${line}</p>`).join('') +
  `</main><footer>© Synthetic payer portal. Demo content only.</footer></body></html>`;

const SOURCES: SourceDef[] = [
  {
    payerId: 'UHC',
    name: 'Commercial medical & drug policies',
    url: 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html',
    description: 'Index of UnitedHealthcare commercial medical, drug, and reimbursement policies.',
    baseline: [
      'Commercial Medical & Drug Policies — Policy update bulletin',
      'Last updated: 08/01/2026',
      'Remote Patient Monitoring (CPT 99453, 99454, 99457, 99458): Covered when criteria in the Remote Physiologic Monitoring policy are met.',
      'Polysomnography and Home Sleep Apnea Testing (CPT 95810, 95811, G0399): Covered for evaluation of suspected obstructive sleep apnea.',
      'Chronic Care Management (CPT 99490, 99439): Covered; one practitioner per calendar month.',
      'Colonoscopy (CPT 45378, 45380, 45385): Covered as screening or diagnostic per policy.',
      'Office visit evaluation & management (CPT 99213, 99214, 99215): Reimbursed per the E/M reimbursement policy.',
    ],
    revisions: [
      {
        daysAgo: 0,
        lines: [
          'Commercial Medical & Drug Policies — Policy update bulletin',
          'Last updated: 09/15/2026',
          'Remote Patient Monitoring (CPT 99453, 99454, 99457, 99458): Prior authorization required effective 11/01/2026. Coverage limited to 16 days of device data per 30-day period.',
          'Polysomnography (CPT 95810, 95811): Attended in-lab polysomnography is not medically necessary when home sleep apnea testing (G0399) is appropriate. Requests will be denied without documentation of HSAT contraindication.',
          'Chronic Care Management (CPT 99490, 99439): Covered; one practitioner per calendar month.',
          'Colonoscopy (CPT 45378, 45380, 45385): Covered as screening or diagnostic per policy.',
          'Office visit evaluation & management (CPT 99213, 99214, 99215): Reimbursed per the E/M reimbursement policy.',
        ],
      },
    ],
  },
  {
    payerId: 'AETNA',
    name: 'Medical Clinical Policy Bulletins (CPB)',
    url: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins/medical-clinical-policy-bulletins.html',
    description: 'Aetna CPB index — medical necessity and coverage criteria by topic.',
    baseline: [
      'Medical Clinical Policy Bulletins',
      'CPB 0016 — Back Pain: Invasive Procedures. Revised 05/12/2026.',
      'CPB 0021 — Joint and Trigger Point Injections. Arthrocentesis (CPT 20610, 20611) covered for diagnostic aspiration or therapeutic injection. Revised 02/03/2026.',
      'CPB 0325 — Colonoscopy Screening. CPT 45378 covered every 10 years for average-risk members age 45 and older. Revised 01/15/2026.',
      'CPB 0113 — Botulinum Toxin. Revised 06/30/2026.',
    ],
    revisions: [
      {
        daysAgo: 0,
        lines: [
          'Medical Clinical Policy Bulletins',
          'CPB 0016 — Back Pain: Invasive Procedures. Revised 05/12/2026.',
          'CPB 0021 — Joint and Trigger Point Injections. Arthrocentesis (CPT 20610, 20611) is limited to 3 injections per joint per 12 months. Modifier RT or LT is required to identify laterality; claims without a laterality modifier will be denied. Revised 09/14/2026.',
          'CPB 0325 — Colonoscopy Screening. CPT 45378 covered every 10 years for average-risk members age 45 and older. Revised 01/15/2026.',
          'CPB 0113 — Botulinum Toxin. Revised 06/30/2026.',
        ],
      },
    ],
  },
  {
    payerId: 'CIGNA',
    name: 'Coverage policies A–Z',
    url: 'https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/medical_a-z.html',
    description: 'Cigna medical coverage policies and reimbursement policies index.',
    baseline: [
      'Coverage Policies — A to Z',
      'Physical Therapy (CPT 97110, 97140, 97530): Covered when medically necessary per the Outpatient Rehabilitation policy.',
      'Add-on complexity code (HCPCS G2211): Reimbursed with office visit codes 99202-99215.',
      'Speech Therapy (CPT 92507): Covered for treatment of speech, language, and swallowing disorders.',
      'Reimbursement Policy R30 — Modifier 25. Revised 03/01/2026.',
    ],
    revisions: [
      {
        daysAgo: 1,
        lines: [
          'Coverage Policies — A to Z',
          'Physical Therapy (CPT 97110, 97140, 97530): Limited to a combined maximum of 4 units per day. Modifier GP is required on all physical therapy services; claims without GP will be rejected. Effective 10/01/2026.',
          'Add-on complexity code (HCPCS G2211): Not reimbursable when the office visit is billed with modifier 25 on the same date of service. Effective 10/01/2026.',
          'Speech Therapy (CPT 92507): Covered for treatment of speech, language, and swallowing disorders.',
          'Reimbursement Policy R30 — Modifier 25. Revised 09/14/2026.',
        ],
      },
    ],
  },
  {
    payerId: 'MEDICARE',
    name: 'HCPCS quarterly update',
    url: 'https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update',
    description: 'CMS HCPCS Level II quarterly code additions, deletions, and revisions.',
    baseline: [
      'HCPCS Quarterly Update — July 2026',
      'New codes effective 07/01/2026: J9999 Not otherwise classified antineoplastic drugs.',
      'Chronic Care Management (CPT 99490): Reimbursement per Physician Fee Schedule.',
      'Rapid strep test (CPT 87880): CLIA-waived tests require modifier QW.',
    ],
    revisions: [
      {
        daysAgo: 3,
        lines: [
          'HCPCS Quarterly Update — October 2026',
          'New codes effective 10/01/2026: G0556 Advanced primary care management, 30 minutes. J9999 Not otherwise classified antineoplastic drugs.',
          'Deleted codes effective 10/01/2026: G0511 Rural health clinic or FQHC care management services. Bill CPT 99490 or G0556 instead.',
          'Chronic Care Management (CPT 99490): Reimbursement per Physician Fee Schedule; payment rate increased 2.1%.',
          'Rapid strep test (CPT 87880): CLIA-waived tests require modifier QW.',
        ],
      },
    ],
  },
  {
    payerId: 'BCBS',
    name: 'Medical policies & clinical UM guidelines',
    url: 'https://www.anthem.com/provider/medical-policies/',
    description:
      'Anthem Blue Cross Blue Shield medical policy and clinical utilization management guideline index.',
    baseline: [
      'Medical Policies and Clinical UM Guidelines',
      'CG-MED-68 — Therapeutic Injections: CPT 20610 covered for symptomatic joints. Revised 04/01/2026.',
      'RAD.00061 — Diagnostic Imaging: CPT 71046 covered per clinical indications.',
      'LAB.00033 — Laboratory Panels: CPT 80053, 85025 covered when medically necessary.',
    ],
  },
];

export async function seedPolicyWatch(prisma: PrismaClient) {
  await prisma.auditFinding.deleteMany();
  await prisma.chargemasterItem.deleteMany();
  await prisma.chargemaster.deleteMany();
  await prisma.dailyDigest.deleteMany();
  await prisma.policyChange.deleteMany();
  await prisma.policySnapshot.deleteMany();
  await prisma.policySource.deleteMany();

  const payers = await prisma.payer.findMany();
  const payerByCode = new Map(payers.map((payer) => [payer.payerId, payer.id]));

  const csv = readFileSync(join(process.cwd(), 'public', 'sample-chargemaster.csv'), 'utf8');
  await importChargemaster('FY26 chargemaster (sample)', 'sample-chargemaster.csv', csv);

  let changes = 0;
  const changeDays = new Set<number>();
  for (const def of SOURCES) {
    const payerId = payerByCode.get(def.payerId);
    if (!payerId) continue;
    const source = await prisma.policySource.create({
      data: { payerId, name: def.name, url: def.url, description: def.description },
    });
    const baselineDay = Math.max(7, ...(def.revisions?.map((r) => r.daysAgo + 1) ?? []));
    await recordSnapshot(source.id, page(def.name, def.baseline), {
      summarizer: heuristicSummarizer,
      fetchedAt: daysAgo(baselineDay),
    });
    for (const revision of def.revisions ?? []) {
      const result = await recordSnapshot(source.id, page(def.name, revision.lines), {
        summarizer: heuristicSummarizer,
        fetchedAt: daysAgo(revision.daysAgo),
      });
      if (result.changed) {
        changes++;
        changeDays.add(revision.daysAgo);
      }
    }
  }
  for (const day of [...changeDays, 0, 1, 2].filter((v, i, a) => a.indexOf(v) === i))
    await buildDailyDigest(daysAgo(day), heuristicSummarizer);

  return { sources: SOURCES.length, changes };
}
