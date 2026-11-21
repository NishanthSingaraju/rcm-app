import { extractCodes, type Signal, type Severity } from './policy-diff';
import type { ChangeSummary } from './policy-ai';

export type ChargemasterRow = {
  cptCode: string;
  description: string;
  price: number;
  modifiers?: string;
  revenueCode?: string;
  department?: string;
};

const HEADER_ALIASES: Record<keyof ChargemasterRow, string[]> = {
  cptCode: [
    'cpt',
    'cptcode',
    'cpt_code',
    'hcpcs',
    'hcpcscode',
    'code',
    'procedurecode',
    'procedure_code',
    'cpt/hcpcs',
  ],
  description: [
    'description',
    'desc',
    'chargedescription',
    'charge_description',
    'name',
    'procedure',
    'service',
  ],
  price: [
    'price',
    'charge',
    'chargeamount',
    'charge_amount',
    'amount',
    'fee',
    'rate',
    'standardcharge',
    'gross charge',
  ],
  modifiers: ['modifier', 'modifiers', 'mod'],
  revenueCode: ['revcode', 'revenuecode', 'revenue_code', 'rev'],
  department: ['department', 'dept', 'costcenter', 'cost_center', 'location'],
};

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[^a-z/_ ]/g, '')
    .trim();
}

/** Parse a CSV/TSV chargemaster export; tolerant of column names and currency formatting. */
export function parseChargemasterCsv(text: string): { rows: ChargemasterRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['File is empty.'] };
  const delimiter = lines[0].includes('\t')
    ? '\t'
    : lines[0].includes(';') && !lines[0].includes(',')
      ? ';'
      : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const indexOf = (field: keyof ChargemasterRow) =>
    headers.findIndex(
      (header) =>
        HEADER_ALIASES[field].includes(header.replace(/\s+/g, '')) ||
        HEADER_ALIASES[field].includes(header),
    );
  const idx = {
    cptCode: indexOf('cptCode'),
    description: indexOf('description'),
    price: indexOf('price'),
    modifiers: indexOf('modifiers'),
    revenueCode: indexOf('revenueCode'),
    department: indexOf('department'),
  };
  const errors: string[] = [];
  if (idx.cptCode < 0)
    errors.push('Could not find a CPT/HCPCS code column (expected a header like "CPT" or "Code").');
  if (idx.price < 0)
    errors.push('Could not find a price column (expected a header like "Price" or "Charge").');
  if (errors.length) return { rows: [], errors };

  const rows: ChargemasterRow[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((line, i) => {
    const cells = splitCsvLine(line, delimiter);
    const rawCode = (cells[idx.cptCode] ?? '').toUpperCase().replace(/\s+/g, '');
    const code = extractCodes(rawCode)[0];
    if (!code) {
      errors.push(`Row ${i + 2}: "${cells[idx.cptCode] ?? ''}" is not a valid CPT/HCPCS code.`);
      return;
    }
    const price = Number((cells[idx.price] ?? '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i + 2}: price "${cells[idx.price] ?? ''}" is not a number.`);
      return;
    }
    const modifiers = idx.modifiers >= 0 ? cells[idx.modifiers] || undefined : undefined;
    const key = `${code}|${modifiers ?? ''}`;
    if (seen.has(key)) {
      errors.push(
        `Row ${i + 2}: duplicate entry for ${code}${modifiers ? ` (${modifiers})` : ''}.`,
      );
      return;
    }
    seen.add(key);
    rows.push({
      cptCode: code,
      description: idx.description >= 0 ? cells[idx.description] || code : code,
      price,
      modifiers,
      revenueCode: idx.revenueCode >= 0 ? cells[idx.revenueCode] || undefined : undefined,
      department: idx.department >= 0 ? cells[idx.department] || undefined : undefined,
    });
  });
  return { rows, errors };
}

export type FindingType =
  | 'CODE_REMOVED'
  | 'CODE_ADDED'
  | 'PRIOR_AUTH'
  | 'NOT_COVERED'
  | 'MODIFIER_RULE'
  | 'FREQUENCY_LIMIT'
  | 'POLICY_MENTION';

export type AuditFindingDraft = {
  changeId: string;
  cptCode: string;
  type: FindingType;
  severity: Severity;
  message: string;
  recommendation: string;
  evidence: string;
};

export type AuditChange = {
  id: string;
  payerName: string;
  sourceName: string;
  severity: Severity;
  affectedCodes: string[];
  signals: Signal[];
  summary: ChangeSummary | null;
};

const FINDING_FOR_SIGNAL: Partial<Record<Signal['kind'], FindingType>> = {
  CODE_REMOVED: 'CODE_REMOVED',
  CODE_ADDED: 'CODE_ADDED',
  PRIOR_AUTH: 'PRIOR_AUTH',
  NOT_COVERED: 'NOT_COVERED',
  MODIFIER_RULE: 'MODIFIER_RULE',
  FREQUENCY_LIMIT: 'FREQUENCY_LIMIT',
};

const FINDING_SEVERITY: Record<FindingType, Severity> = {
  CODE_REMOVED: 'HIGH',
  NOT_COVERED: 'HIGH',
  PRIOR_AUTH: 'HIGH',
  MODIFIER_RULE: 'MEDIUM',
  FREQUENCY_LIMIT: 'MEDIUM',
  CODE_ADDED: 'LOW',
  POLICY_MENTION: 'LOW',
};

const FINDING_TEXT: Record<FindingType, { message: string; recommendation: string }> = {
  CODE_REMOVED: {
    message: 'Code was removed or retired in the payer policy.',
    recommendation: 'Confirm with the payer, then end-date or crosswalk this chargemaster line.',
  },
  NOT_COVERED: {
    message: 'Policy now describes this service as not covered / not medically necessary.',
    recommendation: 'Add a scrubber edit, collect ABN/waiver where allowed, and review pricing.',
  },
  PRIOR_AUTH: {
    message: 'Policy now requires prior authorization for this code.',
    recommendation:
      'Add to the prior-auth required list and update scheduling/registration checks.',
  },
  MODIFIER_RULE: {
    message: 'Modifier guidance changed for this code.',
    recommendation: 'Update chargemaster default modifiers and scrubber modifier edits.',
  },
  FREQUENCY_LIMIT: {
    message: 'Frequency or unit limits changed for this code.',
    recommendation: 'Update unit limits in the scrubber and patient estimate tooling.',
  },
  CODE_ADDED: {
    message: 'Code newly referenced in the payer policy.',
    recommendation: 'Verify description and price are current; confirm coverage criteria are met.',
  },
  POLICY_MENTION: {
    message: 'Code appears in changed policy text.',
    recommendation: 'Review the change to confirm no coverage or billing rule moved.',
  },
};

/** Cross-reference chargemaster codes against detected policy changes. Pure. */
export function auditChargemaster(
  items: Pick<ChargemasterRow, 'cptCode'>[],
  changes: AuditChange[],
): AuditFindingDraft[] {
  const codes = new Set(items.map((item) => item.cptCode));
  const findings: AuditFindingDraft[] = [];
  for (const change of changes) {
    const hits = change.affectedCodes.filter((code) => codes.has(code));
    for (const code of hits) {
      const relevant = change.signals.filter((signal) => signal.codes.includes(code));
      const types = [
        ...new Set(
          relevant
            .map((signal) => FINDING_FOR_SIGNAL[signal.kind])
            .filter((type): type is FindingType => !!type),
        ),
      ];
      if (!types.length) types.push('POLICY_MENTION');
      const aiImpact = change.summary?.codeImpacts.find((impact) => impact.code === code);
      for (const type of types) {
        const evidence = relevant
          .filter((signal) => FINDING_FOR_SIGNAL[signal.kind] === type || type === 'POLICY_MENTION')
          .map((signal) => `${signal.direction === 'added' ? '+' : '-'} ${signal.line}`)
          .slice(0, 5)
          .join('\n');
        findings.push({
          changeId: change.id,
          cptCode: code,
          type,
          severity: FINDING_SEVERITY[type],
          message: `${change.payerName} · ${change.sourceName}: ${aiImpact?.impact ?? FINDING_TEXT[type].message}`,
          recommendation: aiImpact?.action ?? FINDING_TEXT[type].recommendation,
          evidence,
        });
      }
    }
  }
  return findings.sort(
    (a, b) => rank(b.severity) - rank(a.severity) || a.cptCode.localeCompare(b.cptCode),
  );
}

function rank(severity: Severity) {
  return severity === 'HIGH' ? 3 : severity === 'MEDIUM' ? 2 : 1;
}
