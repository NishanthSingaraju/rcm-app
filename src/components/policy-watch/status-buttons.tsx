'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { value: string; label: string; payload?: Record<string, unknown> };

export function StatusButtons({
  endpoint,
  current,
  options,
  method = 'PATCH',
}: {
  endpoint: string;
  current: string;
  options: Option[];
  method?: 'PATCH' | 'POST';
}) {
  const router = useRouter();
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  async function set(option: Option) {
    setPending(option.value);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(option.payload ?? { status: option.value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Request failed.');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setPending('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!!pending || option.value === current}
            onClick={() => set(option)}
            className={`rounded border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${
              option.value === current
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40'
            }`}
          >
            {pending === option.value ? '…' : option.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
