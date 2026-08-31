'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DenialActions({ denialId, closed }: { denialId: string; closed: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(endpoint: string, body?: object) {
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Request failed.');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="min-w-56 space-y-2">
      <input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Appeal notes"
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={closed || pending}
          onClick={() => submit(`/api/denials/${denialId}/appeal`, { notes })}
          className="rounded border border-orange-200 px-2 py-1 text-xs font-semibold text-orange-700 disabled:opacity-40"
        >
          Appeal
        </button>
        <button
          type="button"
          disabled={closed || pending}
          onClick={() => submit(`/api/denials/${denialId}/write-off`)}
          className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        >
          Write off
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
