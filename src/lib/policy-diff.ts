export type LineDiff = { added: string[]; removed: string[] };

/** Multiset line diff: order-insensitive so reflowed pages do not create noise. */
export function diffLines(before: string, after: string): LineDiff {
  const count = (text: string) => {
    const map = new Map<string, number>();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      map.set(line, (map.get(line) ?? 0) + 1);
    }
    return map;
  };
  const beforeMap = count(before);
  const afterMap = count(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [line, n] of afterMap) {
    const delta = n - (beforeMap.get(line) ?? 0);
    for (let i = 0; i < delta; i++) added.push(line);
  }
  for (const [line, n] of beforeMap) {
    const delta = n - (afterMap.get(line) ?? 0);
    for (let i = 0; i < delta; i++) removed.push(line);
  }
  return { added, removed };
}

const CPT_PATTERN = /(?<![A-Z0-9.$])(\d{5}|\d{4}[FTU]|[A-CEGHJ-MP-V]\d{4})(?![A-Z0-9]|\.\d)/g;

/** Pull CPT / HCPCS Level II codes out of free text, de-duplicated and sorted. */
export function extractCodes(text: string) {
  const codes = new Set<string>();
  for (const match of text.toUpperCase().matchAll(CPT_PATTERN)) codes.add(match[1]);
  return [...codes].sort();
}

export type Signal = {
  kind:
    | 'PRIOR_AUTH'
    | 'NOT_COVERED'
    | 'CODE_REMOVED'
    | 'CODE_ADDED'
    | 'MODIFIER_RULE'
    | 'FREQUENCY_LIMIT'
    | 'EFFECTIVE_DATE'
    | 'REIMBURSEMENT';
  line: string;
  codes: string[];
  direction: 'added' | 'removed';
};

const SIGNAL_RULES: { kind: Signal['kind']; pattern: RegExp }[] = [
  {
    kind: 'PRIOR_AUTH',
    pattern: /prior auth|pre-?authoriz|precertif|pre-?cert|notification required/i,
  },
  {
    kind: 'NOT_COVERED',
    pattern:
      /not (medically necessary|covered|reimbursable|eligible)|experimental|investigational|unproven|non-?covered|will (be )?den/i,
  },
  {
    kind: 'CODE_REMOVED',
    pattern: /\b(delet|remov|retir|discontinu|terminat|end-?dated|no longer)/i,
  },
  {
    kind: 'CODE_ADDED',
    pattern: /\b(new code|added|now (covered|eligible|reimbursable)|effective for)/i,
  },
  {
    kind: 'MODIFIER_RULE',
    pattern: /modifier|\b-?(25|59|26|TC|JW|JZ|GA|GX|GY|GZ|KX|95|GT|FS|FT)\b/,
  },
  {
    kind: 'FREQUENCY_LIMIT',
    pattern:
      /frequency|per (day|year|calendar|12|365|lifetime)|once every|limit(ed)? to|maximum of|units? per/i,
  },
  {
    kind: 'REIMBURSEMENT',
    pattern: /reimburs|fee schedule|payment (rate|policy|reduction)|allowed amount|\b\d+% of/i,
  },
  {
    kind: 'EFFECTIVE_DATE',
    pattern:
      /effective (date|on|as of|beginning)|last (updated|reviewed|revised)|revision date|\b(0?[1-9]|1[0-2])\/\d{1,2}\/(20)?\d{2}\b/i,
  },
];

export function detectSignals(diff: LineDiff): Signal[] {
  const signals: Signal[] = [];
  const scan = (lines: string[], direction: Signal['direction']) => {
    for (const line of lines) {
      const codes = extractCodes(line);
      for (const rule of SIGNAL_RULES) {
        if (rule.pattern.test(line)) signals.push({ kind: rule.kind, line, codes, direction });
      }
    }
  };
  scan(diff.added, 'added');
  scan(diff.removed, 'removed');
  return signals;
}

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export function scoreSeverity(
  diff: LineDiff,
  signals: Signal[],
  affectedCodes: string[],
): Severity {
  const kinds = new Set(signals.map((signal) => signal.kind));
  if (
    kinds.has('NOT_COVERED') ||
    kinds.has('CODE_REMOVED') ||
    (kinds.has('PRIOR_AUTH') && affectedCodes.length > 0)
  )
    return 'HIGH';
  if (
    affectedCodes.length > 0 ||
    kinds.has('PRIOR_AUTH') ||
    kinds.has('MODIFIER_RULE') ||
    kinds.has('FREQUENCY_LIMIT') ||
    kinds.has('REIMBURSEMENT')
  )
    return 'MEDIUM';
  if (diff.added.length + diff.removed.length > 25) return 'MEDIUM';
  return 'LOW';
}

export function summarizeDiffTitle(diff: LineDiff, affectedCodes: string[]) {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  const codePart = affectedCodes.length
    ? ` · ${affectedCodes.length} code${affectedCodes.length === 1 ? '' : 's'} referenced`
    : '';
  return `${parts.join(', ') || 'Content updated'}${codePart}`;
}

/** Full analysis of two snapshots; pure and deterministic. */
export function analyzeChange(before: string, after: string) {
  const diff = diffLines(before, after);
  const signals = detectSignals(diff);
  const affectedCodes = extractCodes([...diff.added, ...diff.removed].join('\n'));
  const severity = scoreSeverity(diff, signals, affectedCodes);
  return { diff, signals, affectedCodes, severity, title: summarizeDiffTitle(diff, affectedCodes) };
}
