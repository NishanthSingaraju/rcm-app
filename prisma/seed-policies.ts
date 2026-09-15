import { prisma } from '../src/lib/prisma';
import { generateBriefing } from '../src/lib/policy-service';

const day = new Date();
day.setUTCHours(8, 0, 0, 0);
const future = (days: number) => new Date(day.getTime() + days * 86400000);
const sources = [
  {
    id: 'demo-uhc',
    payer: 'UnitedHealthcare',
    name: 'Commercial medical policies',
    url: 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies.html',
  },
  {
    id: 'demo-aetna',
    payer: 'Aetna',
    name: 'Clinical policy bulletins',
    url: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
  },
  {
    id: 'demo-cigna',
    payer: 'Cigna',
    name: 'Coverage policies',
    url: 'https://www.cigna.com/health-care-providers/coverage-and-claims/policies/',
  },
  {
    id: 'demo-humana',
    payer: 'Humana',
    name: 'Medical coverage policies',
    url: 'https://provider.humana.com/coverage-claims/medical-coverage-policies',
  },
  {
    id: 'demo-anthem',
    payer: 'Anthem',
    name: 'Clinical guidelines',
    url: 'https://www.anthem.com/provider/policies/clinical-guidelines/',
  },
  {
    id: 'demo-cms',
    payer: 'CMS / Medicare',
    name: 'Medicare coverage database',
    url: 'https://www.cms.gov/medicare-coverage-database/search.aspx',
  },
];
const changes = [
  {
    id: 'demo-update-1',
    sourceId: 'demo-uhc',
    title: 'Advanced imaging: prior authorization changes',
    category: 'Prior authorization',
    priority: 'High',
    codes: '70551,70552,70553,72148',
    days: 15,
    summary:
      'In this example, prior authorization requirements expand for outpatient MRI services. Four codes in the sample chargemaster need a workflow review.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nPrior authorization is required for contrast-enhanced brain MRI (70552, 70553). Non-contrast brain MRI and lumbar MRI follow the standard referral pathway.',
    currentText:
      'EXAMPLE UPDATED POLICY\nPrior authorization is required for brain MRI with or without contrast (70551, 70552, 70553) and lumbar MRI (72148) before outpatient services are scheduled.',
    recommendation:
      'Review your authorization checklist for 70551 and 72148. Confirm documentation and authorization capture before scheduling. Train the imaging and billing teams.',
    rationale:
      'Missing authorization may cause avoidable denials. The chargemaster match identifies services whose scheduling and billing workflows deserve review; it does not establish a change in charge price.',
  },
  {
    id: 'demo-update-2',
    sourceId: 'demo-aetna',
    title: 'Physical therapy: updated visit documentation',
    category: 'Medical necessity',
    priority: 'High',
    codes: '97110,97112,97530',
    days: 20,
    summary:
      'The example update introduces additional documentation for continued outpatient therapy, including measurable progress and a current treatment plan.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nTherapy claims must include a treatment plan and documentation of services delivered.',
    currentText:
      'EXAMPLE UPDATED POLICY\nContinued therapy for 97110, 97112, and 97530 must include measurable progress, treatment goals, and an updated plan of care.',
    recommendation:
      'Review therapy documentation templates and continued-care review checkpoints with rehabilitation leads.',
    rationale:
      'Consistent documentation helps reviewers establish medical necessity and reduces requests for additional records.',
  },
  {
    id: 'demo-update-3',
    sourceId: 'demo-cigna',
    title: 'Evaluation & management: modifier 25 guidance',
    category: 'Reimbursement',
    priority: 'Medium',
    codes: '99213,99214,99215',
    days: 30,
    summary:
      'Sample guidance clarifies documentation for a separately identifiable E/M service reported with a same-day procedure.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nAppend modifier 25 to qualifying evaluation and management services.',
    currentText:
      'EXAMPLE UPDATED POLICY\nFor 99213–99215 with modifier 25, documentation must support a significant, separately identifiable service beyond the usual work of the procedure.',
    recommendation:
      'Review modifier 25 edits and supporting documentation with the coding team. Avoid automatically appending a modifier.',
    rationale:
      'A code match flags a potential review area. Modifier use depends on the documented encounter and payer-specific guidance.',
  },
  {
    id: 'demo-update-4',
    sourceId: 'demo-cms',
    title: 'Laboratory testing: coverage criteria revision',
    category: 'Coverage',
    priority: 'Medium',
    codes: '80053,85025,83036',
    days: 25,
    summary:
      'This sample coverage revision updates the diagnosis documentation expected for selected laboratory services.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nCoverage depends on medical necessity and an order from the treating clinician.',
    currentText:
      'EXAMPLE UPDATED POLICY\nFor 80053, 85025, and 83036, retain the clinical indication and relevant diagnosis documentation with the order.',
    recommendation:
      'Review order-entry prompts and diagnosis-to-service checks. Verify the applicable Medicare jurisdiction before changing edits.',
    rationale:
      'Coverage depends on clinical context and jurisdiction; an exact CPT match alone does not establish whether a claim is covered.',
  },
  {
    id: 'demo-update-5',
    sourceId: 'demo-humana',
    title: 'Outpatient surgery: site-of-service review',
    category: 'Site of service',
    priority: 'High',
    codes: '29881,29882',
    days: 12,
    summary:
      'In this example, selected outpatient procedures require a documented rationale for a hospital outpatient setting.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nOutpatient knee arthroscopy follows the standard authorization process.',
    currentText:
      'EXAMPLE UPDATED POLICY\nHospital outpatient services for 29881 and 29882 require review of clinical suitability and site-of-service rationale.',
    recommendation:
      'Review site-of-service authorization steps with surgical scheduling. Confirm exceptions with the payer.',
    rationale:
      'The setting of care may affect authorization even when the procedure code remains unchanged.',
  },
  {
    id: 'demo-update-6',
    sourceId: 'demo-anthem',
    title: 'Telehealth: place-of-service clarification',
    category: 'Coding guidance',
    priority: 'Low',
    codes: '99213,99214',
    days: 40,
    summary:
      'Sample guidance distinguishes telehealth services delivered to a patient at home from services delivered at another location.',
    previousText:
      'EXAMPLE PREVIOUS POLICY\nSubmit telehealth claims with the appropriate place-of-service code.',
    currentText:
      'EXAMPLE UPDATED POLICY\nFor eligible 99213 and 99214 telehealth services, verify patient location and the applicable place-of-service code before claim submission.',
    recommendation:
      'Review patient-location capture and telehealth claim edits against the payer’s current instructions.',
    rationale:
      'The correct place of service is determined by the encounter, not just the procedure code.',
  },
];
const catalog = [
  ['70551', 'Brain MRI without contrast', 'Radiology', 620, 180],
  ['70552', 'Brain MRI with contrast', 'Radiology', 840, 120],
  ['70553', 'Brain MRI with and without contrast', 'Radiology', 1100, 95],
  ['72148', 'Lumbar spine MRI without contrast', 'Radiology', 720, 210],
  ['97110', 'Therapeutic exercises', 'Rehabilitation', 85, 2400],
  ['97112', 'Neuromuscular re-education', 'Rehabilitation', 90, 1100],
  ['97530', 'Therapeutic activities', 'Rehabilitation', 95, 850],
  ['99213', 'Established patient office visit', 'Primary care', 150, 3200],
  ['99214', 'Established patient office visit, level 4', 'Primary care', 210, 2600],
  ['99215', 'Established patient office visit, level 5', 'Primary care', 290, 640],
  ['80053', 'Comprehensive metabolic panel', 'Laboratory', 45, 1900],
  ['85025', 'Complete blood count', 'Laboratory', 35, 2200],
  ['83036', 'Hemoglobin A1c', 'Laboratory', 40, 1500],
  ['29881', 'Knee arthroscopy procedure', 'Orthopedics', 3400, 80],
  ['29882', 'Knee meniscus repair', 'Orthopedics', 3900, 50],
  ['93000', 'Electrocardiogram', 'Cardiology', 95, 300],
  ['71046', 'Chest radiograph', 'Radiology', 120, 550],
  ['90471', 'Vaccine administration', 'Primary care', 35, 900],
] as const;

async function main() {
  for (const source of sources) {
    await prisma.policySource.upsert({
      where: { id: source.id },
      create: { ...source, isDemo: true },
      update: {},
    });
  }
  for (const change of changes) {
    const { days, ...data } = change;
    await prisma.policyUpdate.upsert({
      where: { id: data.id },
      create: { ...data, effectiveAt: future(days), createdAt: day },
      update: {},
    });
  }
  if (!(await prisma.chargeCatalog.findUnique({ where: { id: 'active' } }))) {
    await prisma.chargeCatalog.create({
      data: {
        id: 'active',
        filename: 'sample-chargemaster.csv',
        isDemo: true,
        entries: {
          create: catalog.map(([code, description, department, charge, annualVolume]) => ({
            code,
            description,
            department,
            charge,
            annualVolume,
          })),
        },
      },
    });
  }
  await generateBriefing(true);
  console.log('PolicyPulse example workspace ready. All seeded policy changes are illustrative.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
