import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPolicyText, validatePolicyUrl } from '../policy-fetch';

afterEach(() => vi.unstubAllGlobals());

describe('public policy fetching', () => {
  it.each([
    'http://www.aetna.com/policy',
    'https://localhost/policy',
    'https://127.0.0.1/',
    'https://www.aetna.com.evil.example/',
    'https://user:password@www.aetna.com/',
    'https://www.aetna.com:8443/',
    'file:///etc/passwd',
  ])('rejects unsupported source %s', (url) => {
    expect(() => validatePolicyUrl(url)).toThrow();
  });

  it('removes navigation and scripts while preserving policy passages', async () => {
    const text =
      'Medical policy for procedure 70551. Authorization requires a documented referral and relevant clinical information before scheduling the outpatient service. This text is a test fixture.';
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          `<html><body><nav>Ignore navigation</nav><main><h1>Policy update</h1><p>${text}</p><script>ignore()</script></main></body></html>`,
          { headers: { 'Content-Type': 'text/html' } },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const result = await fetchPolicyText('https://www.aetna.com/policy');
    expect(result).toBe(`Policy update\n${text}`);
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
  });

  it('validates redirect destinations before following them', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchPolicyText('https://www.aetna.com/policy')).rejects.toThrow(
      'supported payer domain',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects PDFs instead of treating binary data as policy text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } })),
    );
    await expect(fetchPolicyText('https://www.aetna.com/policy')).rejects.toThrow(
      'dedicated connector',
    );
  });

  it('rejects bot challenges and errors instead of recording them as policy changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(`Access denied ${'x'.repeat(200)}`, {
            headers: { 'Content-Type': 'text/html' },
          }),
        ),
    );
    await expect(fetchPolicyText('https://www.aetna.com/policy')).rejects.toThrow('preserved');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
    await expect(fetchPolicyText('https://www.aetna.com/policy')).rejects.toThrow('HTTP 503');
  });

  it('bounds downloaded content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('x'.repeat(2_000_001), { headers: { 'Content-Type': 'text/plain' } }),
        ),
    );
    await expect(fetchPolicyText('https://www.aetna.com/policy')).rejects.toThrow('2 MB');
  });
});
