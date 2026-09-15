import { createHash } from 'crypto';

const BLOCK_TAGS =
  /<\/(p|div|li|ul|ol|tr|td|th|h[1-6]|section|article|header|footer|table|thead|tbody|br|hr|dt|dd|blockquote|pre)\s*>|<br\s*\/?>|<hr\s*\/?>/gi;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
};

function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Reduce a policy page to stable, comparable plain-text lines. */
export function htmlToText(html: string) {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe|nav|head)[\s\S]*?<\/\1>/gi, '')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(withoutNoise);
  return normalizeLines(text);
}

export function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeLines(decodeEntities(match[1].replace(/<[^>]+>/g, ' '))) : undefined;
}

export function hashContent(text: string) {
  return createHash('sha256').update(text).digest('hex');
}
