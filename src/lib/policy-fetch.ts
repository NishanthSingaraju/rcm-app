import { load } from 'cheerio';

export const allowedPolicyHosts = [
  'www.uhcprovider.com',
  'www.aetna.com',
  'static.cigna.com',
  'www.cigna.com',
  'www.humana.com',
  'provider.humana.com',
  'www.anthem.com',
  'providers.anthem.com',
  'www.cms.gov',
];

export function validatePolicyUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !allowedPolicyHosts.includes(url.hostname)
  )
    throw new Error('Use an HTTPS policy page from a supported payer domain.');
  url.hash = '';
  return url;
}

export async function fetchPolicyText(value: string): Promise<string> {
  let url = validatePolicyUrl(value);
  for (let redirect = 0; redirect <= 4; redirect++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
      headers: {
        'User-Agent': 'PolicyPulse/1.0 (public policy change monitoring)',
        Accept: 'text/html,text/plain',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('The source returned an invalid redirect.');
      url = validatePolicyUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Source returned HTTP ${response.status}.`);
    }
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/(html|plain)/i.test(type)) {
      await response.body?.cancel();
      throw new Error(
        'This source is not an HTML/text page. PDF and sign-in portals need a dedicated connector.',
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The source returned no content.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.length;
        if (bytes > 2_000_000) throw new Error('Source exceeds the 2 MB page limit.');
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    const html = Buffer.concat(chunks).toString('utf8');
    const $ = load(html);
    $('script,style,nav,header,footer,noscript,svg,form,iframe').remove();
    $('br').replaceWith('\n');
    $('p,li,h1,h2,h3,h4,tr,section,article,div').append('\n');
    const region = $('main').first().length ? $('main').first() : $('body');
    const text = region
      .text()
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    if (
      text.length < 150 ||
      /access denied|verify you are human|enable javascript to continue|request unsuccessful/i.test(
        text,
      )
    )
      throw new Error(
        'The policy content is unavailable or blocked. The previous snapshot was preserved.',
      );
    return text.slice(0, 150000);
  }
  throw new Error('Too many source redirects.');
}
