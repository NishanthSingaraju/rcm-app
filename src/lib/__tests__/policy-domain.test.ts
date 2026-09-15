import { describe, expect, it } from 'vitest';
import {
  auditCatalog,
  changedPassages,
  csvCell,
  extractCodeCandidates,
  parseChargemaster,
} from '../policy-domain';

describe('chargemaster import', () => {
  it('preserves code leading zeros, quoted multiline descriptions, commas, and department variants', () => {
    const rows = parseChargemaster(
      '\uFEFFCPT,description,department,charge,annual_volume\r\n00100,"Anesthesia, ""example""\nservice",Surgery,"$1,200.50",12\r\n00100,Alternate location,Clinic,50,0\r\n',
    );
    expect(rows).toEqual([
      {
        code: '00100',
        description: 'Anesthesia, "example"\nservice',
        department: 'Surgery',
        charge: 1200.5,
        annualVolume: 12,
      },
      {
        code: '00100',
        description: 'Alternate location',
        department: 'Clinic',
        charge: 50,
        annualVolume: 0,
      },
    ]);
  });

  it('accepts HCPCS and category III codes without inventing missing volume', () => {
    expect(
      parseChargemaster('code,description,charge\nj0129,Medication,12\n0042t,Procedure,0').map(
        (row) => [row.code, row.annualVolume],
      ),
    ).toEqual([
      ['J0129', null],
      ['0042T', null],
    ]);
  });

  it.each([
    ['code,description,charge\n7055,Bad code,10', '5-character'],
    ['code,description,charge\n70551,Test,', 'charge must'],
    ['code,description,charge\n70551,Test,-1', 'charge must'],
    ['code,description,charge\n70551,Test,NaN', 'charge must'],
    ['code,description,charge\n70551,Test,1.234', 'charge must'],
    ['code,description,charge,annual_volume\n70551,Test,10,1.5', 'whole number'],
    ['code,description,charge\n70551,Test,10,extra', 'column count'],
    ['code,description,charge\n70551,,10', 'description is required'],
    ['code,description,charge\n70551,"broken,10', 'unclosed quote'],
    ['code,description,charge\n70551,"closed"x,10', 'Unexpected text'],
    ['code,description,charge', 'no charge rows'],
    ['description,charge\nTest,10', 'Required columns'],
  ])('rejects invalid imports without returning a partial catalog: %s', (csv, message) => {
    expect(() => parseChargemaster(csv)).toThrow(message);
  });

  it('matches exact codes across all department rows and recomputes for new policies', () => {
    const rows = parseChargemaster(
      'code,description,department,charge\n70551,Brain MRI,Radiology,620\n70551,Brain MRI,Hospital,800\n70552,Other,Clinic,700',
    );
    expect(
      auditCatalog(rows, [{ id: 'a', codes: '70551,99213' }]).map((row) => row.updateIds),
    ).toEqual([['a'], ['a'], []]);
    expect(
      auditCatalog(rows, [
        { id: 'a', codes: '70551' },
        { id: 'b', codes: '70552' },
      ]).map((row) => row.updateIds),
    ).toEqual([['a'], ['a'], ['b']]);
  });
});

describe('policy comparison and code candidates', () => {
  it('compares full lines and ignores whitespace-only changes', () => {
    expect(changedPassages(' Unchanged \nMRI optional\n', 'Unchanged\nMRI required')).toEqual({
      removed: 'MRI optional',
      added: 'MRI required',
    });
  });
  it('expands bounded ranges, preserves leading zeros, and finds codes on both sides', () => {
    expect(
      extractCodeCandidates('CPT 00100–00102, 99213-99215 and HCPCS J0129, 0042T; 99214.'),
    ).toEqual(['00100', '00101', '00102', '0042T', '99213', '99214', '99215', 'J0129']);
  });
  it('does not expand arbitrary large ranges or extract substrings', () => {
    expect(extractCodeCandidates('10000-99999; abc99213xyz; 123456')).toEqual(['10000', '99999']);
  });
  it('neutralizes spreadsheet formulas and escapes exported CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('Office, visit')).toBe('"Office, visit"');
  });
});
