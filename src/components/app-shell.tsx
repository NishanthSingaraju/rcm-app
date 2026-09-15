'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return children;
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-7 lg:block">
        <Link href="/" className="mb-8 block text-xl font-bold text-violet-700">
          PolicyPulse
        </Link>
        <nav className="space-y-1 text-sm font-medium text-slate-600">
          {[
            ['/', 'Policy monitor'],
            ['/revenue', 'Revenue dashboard'],
            ['/patients', 'Patients'],
            ['/encounters', 'Encounters'],
            ['/claims', 'Claims'],
            ['/denials', 'Denials'],
            ['/remittances', 'Remittances'],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2.5 hover:bg-violet-50"
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-12 text-xs text-slate-500">Synthetic data · Demo only</p>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="border-b bg-white px-8 py-5 font-semibold">
          ClearCycle revenue operations
        </header>
        <div className="mx-auto max-w-[1500px] p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
