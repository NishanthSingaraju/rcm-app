import { describe, expect, it } from 'vitest';
import { auditChargemaster, parseChargemasterCsv } from '../chargemaster';
import { heuristicSummary } from '../policy-ai';
import { analyzeChange, diffLines, extractCodes } from '../policy-diff';
import { hashContent, htmlToText } from '../policy-text';

describe('htmlToText', () => {
  it('strips scripts, nav, and tags into normalized lines', () => {
    const html = `<html><head><title>Policies</title><script>var x=1;</script></head>
      <body><nav>Menu</nav><h1>Medical &amp; Drug Policies</h1>
      <p>Prior   authorization required for <b>CPT 99457</b>.</p><ul><li>Item one</li><li>Item two</li></ul></body></html>`;
    expect(htmlToText(html)).toBe(
      'Medical & Drug Policies\nPrior authorization required for CPT 99457 .\nItem one\nItem two',
    );
  });

  it('hashes identically for whitespace-only differences', () => {
    const a = htmlToText('<p>Alpha</p>\n\n<p>Beta   gamma</p>');
    const b = htmlToText('<p>Alpha</p><p>Beta gamma</p>');
    expect(hashContent(a)).toBe(hashContent(b));
  });
});

describe('extractCodes', () => {
  it('finds CPT, category II/III, and HCPCS codes but not years or prices', () => {
    expect(
      extractCodes(
        'Effective 10/01/2026 codes 99213, G2211 and 0001F and 0042T; $12345 fee; 20610.',
      ),
    ).toEqual(['0001F', '0042T', '20610', '99213', 'G2211']);
  });

  it('ignores digits embedded in larger numbers or decimals', () => {
    expect(extractCodes('Policy 123456789 and 1.23456 and version 4.99213')).toEqual([]);
  });
});

describe('diffLines', () => {
  it('is order-insensitive and reports added and removed lines', () => {
    const before = 'A\nB\nC';
    const after = 'C\nB\nD';
    expect(diffLines(before, after)).toEqual({ added: ['D'], removed: ['A'] });
  });
});

describe('analyzeChange', () => {
  const before = 'Remote monitoring (99457, 99458): covered.\nColonoscopy 45378: covered.';
  const after =
    'Remote monitoring (99457, 99458): prior authorization required effective 11/01/2026.\nColonoscopy 45378: covered.';

  it('detects prior auth signal, affected codes, and high severity', () => {
    const result = analyzeChange(before, after);
    expect(result.affectedCodes).toEqual(['99457', '99458']);
    expect(result.signals.map((s) => s.kind)).toContain('PRIOR_AUTH');
    expect(result.severity).toBe('HIGH');
  });

  it('scores unchanged or cosmetic content as low', () => {
    const result = analyzeChange('Welcome\nLast reviewed', 'Welcome\nLast reviewed\nContact us');
    expect(result.severity).toBe('LOW');
    expect(result.affectedCodes).toEqual([]);
  });

  it('produces a heuristic summary that references chargemaster overlap', () => {
    const analysis = analyzeChange(before, after);
    const summary = heuristicSummary({
      payerName: 'UHC',
      sourceName: 'Policies',
      url: 'https://example.com',
      severity: analysis.severity,
      diff: analysis.diff,
      signals: analysis.signals,
      affectedCodes: analysis.affectedCodes,
      chargemasterCodes: ['99457'],
    });
    expect(summary.headline).toContain('UHC');
    expect(summary.whyItMatters).toContain('99457');
    expect(summary.codeImpacts.map((c) => c.code)).toEqual(['99457', '99458']);
    expect(summary.whatToUpdate.some((step) => /prior-auth/i.test(step))).toBe(true);
  });
});

describe('parseChargemasterCsv', () => {
  it('maps flexible headers and tolerates currency formatting', () => {
    const csv =
      'Code,Charge Description,Standard Charge,Mod\n99213,"Office visit, est",\'$125.00\',\nJ0696,Ceftriaxone,"75",\n';
    const { rows, errors } = parseChargemasterCsv(csv.replace(/'/g, ''));
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        cptCode: '99213',
        description: 'Office visit, est',
        price: 125,
        modifiers: undefined,
        revenueCode: undefined,
        department: undefined,
      },
      {
        cptCode: 'J0696',
        description: 'Ceftriaxone',
        price: 75,
        modifiers: undefined,
        revenueCode: undefined,
        department: undefined,
      },
    ]);
  });

  it('reports bad rows and missing columns', () => {
    expect(parseChargemasterCsv('Description,Price\nfoo,1').errors[0]).toMatch(/code column/i);
    const { rows, errors } = parseChargemasterCsv('CPT,Price\nABC,10\n99213,abc\n99213,5\n99213,6');
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(3);
    expect(errors[2]).toMatch(/duplicate/i);
  });
});

describe('auditChargemaster', () => {
  it('only flags codes present in the chargemaster and maps signals to finding types', () => {
    const analysis = analyzeChange(
      'Codes 20610 covered.\nCode 95810 covered.',
      'Codes 20610 limited to 3 per 12 months; modifier RT required.\nCode 95810 is not medically necessary when HSAT is appropriate.',
    );
    const findings = auditChargemaster(
      [{ cptCode: '20610' }, { cptCode: '99213' }],
      [
        {
          id: 'chg1',
          payerName: 'Aetna',
          sourceName: 'CPB',
          severity: analysis.severity,
          affectedCodes: analysis.affectedCodes,
          signals: analysis.signals,
          summary: null,
        },
      ],
    );
    expect(findings.every((f) => f.cptCode === '20610')).toBe(true);
    expect(findings.map((f) => f.type).sort()).toEqual(['FREQUENCY_LIMIT', 'MODIFIER_RULE']);
    expect(findings[0].evidence).toContain('+ Codes 20610');
  });
});
