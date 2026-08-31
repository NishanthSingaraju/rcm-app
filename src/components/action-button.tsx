'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ActionButtonProps = {
  endpoint: string;
  label: string;
  disabled?: boolean;
  body?: object;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function ActionButton({
  endpoint,
  label,
  disabled,
  body = {},
  variant = 'secondary',
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const classes = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-orange-600 text-white hover:bg-orange-700',
  };

  async function run() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    <div>
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${classes[variant]}`}
      >
        {pending ? 'Working…' : label}
      </button>
      {error && <p className="mt-2 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
