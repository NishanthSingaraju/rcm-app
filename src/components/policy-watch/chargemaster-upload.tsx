'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Result = { imported: number; findings: number; warnings: string[] };

export function ChargemasterUpload() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/chargemaster', {
        method: 'POST',
        body: new FormData(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Upload failed.');
      setResult(data);
      form.reset();
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Upload failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Upload chargemaster</h2>
        <p className="mt-1 text-sm text-slate-500">
          CSV or TSV with a code column (CPT / HCPCS), a price column, and optional description,
          modifiers, revenue code, and department.{' '}
          <a href="/sample-chargemaster.csv" download className="font-semibold text-blue-600">
            Download sample
          </a>
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <label className="text-xs font-semibold uppercase text-slate-500">
          Name
          <input
            name="name"
            placeholder="FY26 chargemaster"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold uppercase text-slate-500">
          File
          <input
            name="file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            required
            className="mt-1 block w-full text-sm font-normal text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? 'Auditing…' : 'Upload and audit'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Imported {result.imported} lines and generated {result.findings} audit finding
          {result.findings === 1 ? '' : 's'}.
          {result.warnings.length > 0 && (
            <details className="mt-2 text-xs text-emerald-900">
              <summary className="cursor-pointer font-semibold">
                {result.warnings.length} row{result.warnings.length === 1 ? '' : 's'} skipped
              </summary>
              <ul className="mt-1 list-disc pl-5">
                {result.warnings.slice(0, 20).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
