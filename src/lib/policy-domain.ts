export type CatalogRow = {
  code: string;
  description: string;
  department: string;
  charge: number;
  annualVolume: number | null;
};

export const codePattern = /^(?:\d{5}|[A-Z]\d{4}|\d{4}[A-Z])$/;

export function parseChargemaster(input: string): CatalogRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const text = input.replace(/^\uFEFF/, '');
  if (text.length > 2_000_000) throw new Error('The CSV must be smaller than 2 MB.');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === '"' && !field && !closed) {
      quoted = true;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field.trim());
      field = '';
      closed = false;
      if (char !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else {
      if (closed && char.trim()) throw new Error('Unexpected text after a quoted CSV field.');
      if (char === '"') throw new Error('Quotes inside CSV fields must be escaped.');
      field += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quote.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const header = rows.shift()?.map((value) => value.toLowerCase().replace(/[\s_-]/g, '')) ?? [];
  const column = (...names: string[]) => header.findIndex((name) => names.includes(name));
  const code = column('code', 'cpt', 'cptcode', 'hcpcs', 'hcpcscode');
  const description = column('description', 'servicedescription');
  const charge = column('charge', 'price', 'chargeamount');
  const department = column('department', 'dept');
  const volume = column('annualvolume', 'volume');
  if (code < 0 || description < 0 || charge < 0)
    throw new Error('Required columns: code (or CPT), description, and charge.');
  if (!rows.length) throw new Error('The CSV has no charge rows.');
  if (rows.length > 10000) throw new Error('Upload up to 10,000 rows at a time.');
  return rows.map((values, index) => {
    const fail = (message: string): never => {
      throw new Error(`Row ${index + 2}: ${message}`);
    };
    if (values.length !== header.length) fail('column count does not match the header.');
    const normalizedCode = values[code].toUpperCase();
    if (!codePattern.test(normalizedCode))
      fail('use a 5-character CPT or HCPCS code; preserve leading zeros.');
    const amountText = values[charge].replace(/[$,]/g, '');
    const amount = Number(amountText);
    if (
      !amountText ||
      !/^\d+(\.\d{1,2})?$/.test(amountText) ||
      !Number.isFinite(amount) ||
      amount > 1e9
    )
      fail('charge must be a non-negative amount with up to two decimals.');
    const volumeText = volume >= 0 ? values[volume] : '';
    const annualVolume = volumeText ? Number(volumeText) : null;
    if (
      annualVolume !== null &&
      (!/^\d+$/.test(volumeText) || !Number.isSafeInteger(annualVolume) || annualVolume > 1e9)
    )
      fail('annual volume must be a non-negative whole number.');
    if (!values[description]) fail('description is required.');
    return {
      code: normalizedCode,
      description: values[description].slice(0, 500),
      department: department >= 0 ? values[department].slice(0, 100) : 'General',
      charge: amount,
      annualVolume,
    };
  });
}

export function extractCodeCandidates(text: string): string[] {
  const codes = new Set(text.toUpperCase().match(/\b(?:\d{5}|[A-Z]\d{4}|\d{4}[A-Z])\b/g) ?? []);
  for (const match of text.matchAll(/\b(\d{5})\s*[-–]\s*(\d{5})\b/g)) {
    const start = Number(match[1]),
      end = Number(match[2]);
    if (end >= start && end - start <= 100) {
      for (let code = start; code <= end; code++) codes.add(String(code).padStart(5, '0'));
    }
  }
  return [...codes].sort();
}

export function changedPassages(before: string, after: string) {
  const previous = before
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const current = after
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const previousSet = new Set(previous),
    currentSet = new Set(current);
  return {
    removed: previous.filter((line) => !currentSet.has(line)).join('\n'),
    added: current.filter((line) => !previousSet.has(line)).join('\n'),
  };
}

export function auditCatalog<T extends CatalogRow>(
  entries: T[],
  updates: { id: string; codes: string }[],
) {
  return entries.map((entry) => ({
    ...entry,
    updateIds: updates
      .filter((update) => update.codes.split(',').includes(entry.code))
      .map((update) => update.id),
  }));
}

export function csvCell(value: string | number | null) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
