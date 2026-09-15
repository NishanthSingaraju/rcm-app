import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ClearCycle RCM',
  description: 'Synthetic healthcare revenue cycle management demo',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-7 lg:block">
            <Link href="/" className="mb-9 block">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                ClearCycle
              </div>
              <div className="text-xl font-bold text-slate-900">Revenue Cycle</div>
            </Link>
            <nav className="space-y-1 text-sm font-medium text-slate-600">
              {[
                ['/', 'Dashboard'],
                ['/patients', 'Patients'],
                ['/encounters', 'Encounters'],
                ['/claims', 'Claims'],
                ['/denials', 'Denials'],
                ['/remittances', 'Remittances'],
                ['/policy-watch', 'Policy Watch'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-12 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              Synthetic data environment
              <br />
              <span className="font-semibold text-slate-700">No PHI · Demo only</span>
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 lg:hidden">
                  ClearCycle
                </div>
                <h1 className="text-lg font-semibold text-slate-900">Revenue operations</h1>
              </div>
              <div className="text-sm text-slate-500">Practice operations · Demo</div>
            </header>
            <div className="mx-auto max-w-[1500px] p-6 lg:p-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
