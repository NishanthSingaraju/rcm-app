import type { LineDiff, Signal, Severity } from './policy-diff';

export type CodeImpact = { code: string; impact: string; action: string };

export type ChangeSummary = {
  headline: string;
  whatChanged: string;
  whyItMatters: string;
  whatToUpdate: string[];
  codeImpacts: CodeImpact[];
};

export type ChangeContext = {
  payerName: string;
  sourceName: string;
  url: string;
  severity: Severity;
  diff: LineDiff;
  signals: Signal[];
  affectedCodes: string[];
  chargemasterCodes?: string[];
};

export type Summarizer = { model: string; summarize(ctx: ChangeContext): Promise<ChangeSummary> };

const SIGNAL_LABEL: Record<Signal['kind'], string> = {
  PRIOR_AUTH: 'prior authorization language',
  NOT_COVERED: 'non-coverage / medical-necessity language',
  CODE_REMOVED: 'removed or retired codes',
  CODE_ADDED: 'newly added codes or coverage',
  MODIFIER_RULE: 'modifier requirements',
  FREQUENCY_LIMIT: 'frequency or unit limits',
  EFFECTIVE_DATE: 'effective / revision dates',
  REIMBURSEMENT: 'reimbursement or fee schedule terms',
};

const IMPACT_TEXT: Record<Signal['kind'], { impact: string; action: string }> = {
  PRIOR_AUTH: {
    impact: 'Claims may deny without an authorization on file.',
    action: 'Add this code to the prior-auth required list and update front-end workflows.',
  },
  NOT_COVERED: {
    impact: 'Payer now treats this service as not covered or not medically necessary.',
    action:
      'Flag in the scrubber, obtain ABN/waiver where applicable, review chargemaster pricing.',
  },
  CODE_REMOVED: {
    impact: 'Code removed from the policy; billing it may reject or deny.',
    action: 'Retire or crosswalk the code in the chargemaster and charge capture templates.',
  },
  CODE_ADDED: {
    impact: 'Code newly referenced; coverage or billing rules now apply.',
    action: 'Confirm the code exists in the chargemaster with a current price and description.',
  },
  MODIFIER_RULE: {
    impact: 'Modifier requirements changed; missing modifiers cause rejections.',
    action: 'Update scrubber edits and coder guidance for the required modifiers.',
  },
  FREQUENCY_LIMIT: {
    impact: 'Units or frequency limits changed; excess units will be denied.',
    action: 'Update unit/frequency edits and patient-liability estimates.',
  },
  EFFECTIVE_DATE: {
    impact: 'The effective date determines which dates of service are affected.',
    action: 'Schedule chargemaster and edit updates to take effect on the stated date.',
  },
  REIMBURSEMENT: {
    impact: 'Expected reimbursement changed for this code.',
    action: 'Update contract/fee schedule tables and expected-allowed calculations.',
  },
};

const PRIORITY: Signal['kind'][] = [
  'NOT_COVERED',
  'CODE_REMOVED',
  'PRIOR_AUTH',
  'MODIFIER_RULE',
  'FREQUENCY_LIMIT',
  'REIMBURSEMENT',
  'CODE_ADDED',
  'EFFECTIVE_DATE',
];

/** Deterministic summary used when no LLM key is configured or the API call fails. */
export function heuristicSummary(ctx: ChangeContext): ChangeSummary {
  const { diff, signals, affectedCodes, payerName, sourceName, severity } = ctx;
  const kinds = PRIORITY.filter((kind) => signals.some((signal) => signal.kind === kind));
  const inChargemaster = affectedCodes.filter((code) => ctx.chargemasterCodes?.includes(code));

  const headline = kinds.length
    ? `${payerName}: ${SIGNAL_LABEL[kinds[0]]} updated on ${sourceName}`
    : `${payerName}: ${sourceName} content changed`;

  const whatChanged = [
    `${diff.added.length} line${diff.added.length === 1 ? '' : 's'} added and ${diff.removed.length} removed on "${sourceName}".`,
    kinds.length ? `Detected ${kinds.map((kind) => SIGNAL_LABEL[kind]).join(', ')}.` : '',
    affectedCodes.length
      ? `Codes referenced in the changed text: ${affectedCodes.slice(0, 12).join(', ')}${affectedCodes.length > 12 ? '…' : ''}.`
      : 'No CPT/HCPCS codes appear in the changed text.',
  ]
    .filter(Boolean)
    .join(' ');

  const whyItMatters =
    severity === 'HIGH'
      ? `High impact: this change can directly cause denials or rejections${inChargemaster.length ? ` for ${inChargemaster.length} code${inChargemaster.length === 1 ? '' : 's'} currently in your chargemaster (${inChargemaster.join(', ')})` : ''}. Updating before the effective date protects first-pass yield.`
      : severity === 'MEDIUM'
        ? `Medium impact: billing rules or expected reimbursement shifted${inChargemaster.length ? `, touching chargemaster codes ${inChargemaster.join(', ')}` : ''}. Left unaddressed this shows up as avoidable edits, underpayments, or rework.`
        : 'Low impact: mostly informational or formatting changes. Review to confirm no coding guidance moved.';

  const whatToUpdate = [
    ...kinds.map((kind) => IMPACT_TEXT[kind].action),
    inChargemaster.length
      ? `Run the chargemaster audit and review findings for ${inChargemaster.join(', ')}.`
      : affectedCodes.length
        ? 'Confirm whether any referenced codes should be added to the chargemaster.'
        : 'No chargemaster action required; log the review.',
  ];

  const codeImpacts: CodeImpact[] = affectedCodes.map((code) => {
    const kind =
      PRIORITY.find((candidate) =>
        signals.some((signal) => signal.kind === candidate && signal.codes.includes(code)),
      ) ?? kinds[0];
    const text = kind ? IMPACT_TEXT[kind] : IMPACT_TEXT.CODE_ADDED;
    const marker = ctx.chargemasterCodes?.includes(code) ? ' (in chargemaster)' : '';
    return { code, impact: `${text.impact}${marker}`, action: text.action };
  });

  return {
    headline,
    whatChanged,
    whyItMatters,
    whatToUpdate: [...new Set(whatToUpdate)],
    codeImpacts,
  };
}

export const heuristicSummarizer: Summarizer = {
  model: 'heuristic-v1',
  summarize: async (ctx) => heuristicSummary(ctx),
};

function truncateLines(lines: string[], max: number, maxChars = 6000) {
  const slice = lines.slice(0, max).join('\n');
  return slice.length > maxChars ? `${slice.slice(0, maxChars)}\n…` : slice;
}

export function buildPrompt(ctx: ChangeContext) {
  return `You are a revenue-cycle analyst. A payer policy page changed. Produce a JSON object with keys:
headline (string, <= 120 chars), whatChanged (string), whyItMatters (string), whatToUpdate (string[] of concrete actions),
codeImpacts (array of {code, impact, action} for each CPT/HCPCS code affected).
Be specific about denials, prior auth, modifiers, frequency limits, and effective dates. Do not invent codes that are not in the diff.

Payer: ${ctx.payerName}
Policy page: ${ctx.sourceName} (${ctx.url})
Heuristic severity: ${ctx.severity}
Codes in changed text: ${ctx.affectedCodes.join(', ') || 'none'}
Codes also present in the practice chargemaster: ${ctx.chargemasterCodes?.filter((c) => ctx.affectedCodes.includes(c)).join(', ') || 'none'}

ADDED LINES:
${truncateLines(ctx.diff.added, 80) || '(none)'}

REMOVED LINES:
${truncateLines(ctx.diff.removed, 80) || '(none)'}`;
}

function coerceSummary(raw: unknown, fallback: ChangeSummary): ChangeSummary {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const str = (value: unknown, def: string) => (typeof value === 'string' && value ? value : def);
  const list = (value: unknown, def: string[]) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : def;
  const impacts = Array.isArray(obj.codeImpacts)
    ? obj.codeImpacts
        .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
        .map((v) => ({
          code: str(v.code, ''),
          impact: str(v.impact, ''),
          action: str(v.action, ''),
        }))
        .filter((v) => v.code)
    : fallback.codeImpacts;
  return {
    headline: str(obj.headline, fallback.headline),
    whatChanged: str(obj.whatChanged, fallback.whatChanged),
    whyItMatters: str(obj.whyItMatters, fallback.whyItMatters),
    whatToUpdate: list(obj.whatToUpdate, fallback.whatToUpdate),
    codeImpacts: impacts,
  };
}

/** OpenAI-compatible chat completion summarizer (works with any OPENAI_BASE_URL compatible host). */
export function openAiSummarizer(apiKey: string, model: string, baseUrl: string): Summarizer {
  return {
    model,
    async summarize(ctx) {
      const fallback = heuristicSummary(ctx);
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return only valid JSON.' },
            { role: 'user', content: buildPrompt(ctx) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`LLM request failed (${response.status}).`);
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('LLM returned no content.');
      return coerceSummary(JSON.parse(content), fallback);
    },
  };
}

export function defaultSummarizer(env: NodeJS.ProcessEnv = process.env): Summarizer {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return heuristicSummarizer;
  return openAiSummarizer(
    apiKey,
    env.OPENAI_MODEL ?? 'gpt-4o-mini',
    env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  );
}

export type DigestInput = {
  date: Date;
  changes: {
    payerName: string;
    sourceName: string;
    severity: Severity;
    affectedCodes: string[];
    summary: ChangeSummary;
  }[];
  sourcesChecked: number;
  openFindings: number;
};

export function heuristicDigest(input: DigestInput) {
  const { changes } = input;
  const high = changes.filter((c) => c.severity === 'HIGH');
  const medium = changes.filter((c) => c.severity === 'MEDIUM');
  const codes = [...new Set(changes.flatMap((c) => c.affectedCodes))].sort();
  const payers = [...new Set(changes.map((c) => c.payerName))];
  const headline = changes.length
    ? `${changes.length} policy change${changes.length === 1 ? '' : 's'} across ${payers.length} payer${payers.length === 1 ? '' : 's'} · ${high.length} high impact`
    : `No policy changes detected across ${input.sourcesChecked} monitored pages`;
  const lines: string[] = [];
  lines.push(
    changes.length
      ? `Monitored ${input.sourcesChecked} payer policy pages. ${high.length} high-impact and ${medium.length} medium-impact changes need review. ${codes.length} CPT/HCPCS code${codes.length === 1 ? '' : 's'} referenced: ${codes.slice(0, 15).join(', ')}${codes.length > 15 ? '…' : ''}.`
      : `Monitored ${input.sourcesChecked} payer policy pages; all content matched the previous snapshot.`,
  );
  if (input.openFindings)
    lines.push(
      `Chargemaster audit has ${input.openFindings} open finding${input.openFindings === 1 ? '' : 's'} to work.`,
    );
  for (const change of [...high, ...medium, ...changes.filter((c) => c.severity === 'LOW')]) {
    lines.push('');
    lines.push(`[${change.severity}] ${change.payerName} — ${change.summary.headline}`);
    lines.push(`What changed: ${change.summary.whatChanged}`);
    lines.push(`Why update: ${change.summary.whyItMatters}`);
    if (change.summary.whatToUpdate.length)
      lines.push(`Update: ${change.summary.whatToUpdate.slice(0, 3).join(' ')}`);
  }
  return { headline, body: lines.join('\n') };
}

export async function generateDigest(
  input: DigestInput,
  summarizer: Summarizer,
): Promise<{ headline: string; body: string; model: string }> {
  const fallback = heuristicDigest(input);
  if (summarizer.model === heuristicSummarizer.model || !process.env.OPENAI_API_KEY)
    return { ...fallback, model: heuristicSummarizer.model };
  try {
    const response = await fetch(
      `${(process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: summarizer.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return only valid JSON with keys headline and body.' },
            {
              role: 'user',
              content: `Write a daily briefing for a medical billing team (JSON: {headline, body}). Body is plain text with short sections: what happened, how things are different, what to update and why, which codes are affected. Data:\n${JSON.stringify(
                {
                  date: input.date.toISOString().slice(0, 10),
                  sourcesChecked: input.sourcesChecked,
                  openFindings: input.openFindings,
                  changes: input.changes,
                },
                null,
                1,
              ).slice(0, 20000)}`,
            },
          ],
        }),
      },
    );
    if (!response.ok) return { ...fallback, model: heuristicSummarizer.model };
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
      headline?: string;
      body?: string;
    };
    return {
      headline: parsed.headline || fallback.headline,
      body: parsed.body || fallback.body,
      model: summarizer.model,
    };
  } catch {
    return { ...fallback, model: heuristicSummarizer.model };
  }
}
