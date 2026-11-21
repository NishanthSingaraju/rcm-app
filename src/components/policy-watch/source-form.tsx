'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PayerOption = { id: string; name: string };

export function SourceForm({ payers }: { payers: PayerOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/policy-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: data.get('payerId'),
          name: data.get('name'),
          url: data.get('url'),
          description: data.get('description') || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add source.');
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to add source.');
    } finally {
      setPending(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        + Add policy page
      </button>
    );

  const input = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal';
  return (
    <form onSubmit={submit} className="card w-full space-y-3 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-slate-500">
          Payer
          <select name="payerId" required className={input}>
            {payers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-slate-500">
          Page name
          <input name="name" required placeholder="Medical policy index" className={input} />
        </label>
        <label className="text-xs font-semibold uppercase text-slate-500 md:col-span-2">
          URL
          <input
            name="url"
            type="url"
            required
            placeholder="https://www.example-payer.com/providers/policies"
            className={input}
          />
        </label>
        <label className="text-xs font-semibold uppercase text-slate-500 md:col-span-2">
          Notes (optional)
          <input name="description" placeholder="What this page lists" className={input} />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save and monitor'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
