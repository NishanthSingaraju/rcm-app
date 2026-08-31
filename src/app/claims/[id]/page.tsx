import Link from 'next/link';
import { ClaimActions } from '@/components/claim-actions';
import { prisma } from '@/lib/prisma';

export default async function ClaimDetail({ params }: { params: Promise<{ id: string }> }) {
  const claim = await prisma.claim.findUnique({
    where: { id: (await params).id },
    include: {
      patient: true,
      payer: true,
      lines: true,
      edits: true,
      events: { orderBy: { createdAt: 'desc' } },
      denials: true,
      remittanceLines: { include: { remittance: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!claim)
    return (
      <div className="card p-8">
        Claim not found.{' '}
        <Link className="text-blue-600" href="/claims">
          Back to claims
        </Link>
      </div>
    );
  const denial =
    claim.denials.find((item) => !['RESOLVED', 'WRITTEN_OFF'].includes(item.status)) ??
    claim.denials[0];
  return (
    <div className="space-y-6">
      <Link href="/claims" className="text-sm font-medium text-blue-600">
        ← Claims worklist
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{claim.claimNumber}</p>
          <h1 className="mt-1 text-3xl font-bold">
            {claim.patient.firstName} {claim.patient.lastName}
          </h1>
          <p className="mt-2 text-slate-500">
            {claim.payer.name} · {claim.status}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 text-right text-sm">
          <div>
            <p className="text-slate-500">Charge</p>
            <p className="mt-1 font-bold tabular-nums">${claim.totalCharge.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500">Paid</p>
            <p className="mt-1 font-bold tabular-nums">${claim.totalPaid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500">Balance</p>
            <p className="mt-1 font-bold tabular-nums text-blue-700">${claim.balance.toFixed(2)}</p>
          </div>
        </div>
      </div>
      <ClaimActions
        claimId={claim.id}
        status={claim.status}
        balance={claim.balance}
        hasErrors={claim.edits.some((edit) => edit.severity === 'ERROR')}
        denialId={denial?.id}
        denialStatus={denial?.status}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Scrubber findings</h2>
          </div>
          {claim.edits.length ? (
            claim.edits.map((edit) => (
              <div className="flex gap-3 border-b border-slate-100 px-5 py-4 text-sm" key={edit.id}>
                <span
                  className={`rounded px-2 py-1 text-xs font-bold ${edit.severity === 'ERROR' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
                >
                  {edit.code}
                </span>
                <div>
                  <p className="font-medium">{edit.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{edit.field}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-emerald-700">No scrubber findings.</p>
          )}
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Audit timeline</h2>
          </div>
          {claim.events.map((event) => (
            <div className="border-b border-slate-100 px-5 py-4" key={event.id}>
              <p className="text-sm font-medium">{event.description}</p>
              <p className="mt-1 text-xs text-slate-400">
                {event.type} · {event.createdAt.toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Line items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Line</th>
                <th className="px-5 py-3">CPT</th>
                <th className="px-5 py-3 text-right">Charge</th>
                <th className="px-5 py-3 text-right">Allowed</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Patient resp.</th>
              </tr>
            </thead>
            <tbody>
              {claim.lines.map((line) => (
                <tr className="border-t border-slate-100" key={line.id}>
                  <td className="px-5 py-3">{line.lineNumber}</td>
                  <td className="px-5 py-3 font-semibold">{line.cptCode}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    ${line.chargeAmount.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    ${line.allowedAmount.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    ${line.paidAmount.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    ${line.patientResponsibility.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Remittance and payment lines</h2>
        </div>
        {claim.remittanceLines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Check</th>
                  <th className="px-5 py-3 text-right">Allowed</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3">CARC/RARC</th>
                </tr>
              </thead>
              <tbody>
                {claim.remittanceLines.map((line) => (
                  <tr className="border-t border-slate-100" key={line.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/remittances/${line.remittance.id}`}
                        className="font-semibold text-blue-700"
                      >
                        {line.remittance.checkNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      ${line.allowedAmount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      ${line.paidAmount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      {line.carc ?? '—'} {line.rarc ? `/ ${line.rarc}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">No remittance lines posted yet.</p>
        )}
      </section>
    </div>
  );
}
