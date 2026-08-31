'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type Code = { code: string; description: string; defaultCharge?: number };
type Charge = {
  id: string;
  cptCode: string;
  modifiers: string;
  units: number;
  chargeAmount: number;
  diagnosisPointers: string;
};
type EncounterDiagnosis = {
  id: string;
  sequence: number;
  diagnosisCode: string;
  diagnosis: { description: string };
};

export function ChargeCapture({
  encounterId,
  procedures,
  diagnoses,
  existingCharges,
  nextSequence,
  diagnosisCodes,
}: {
  encounterId: string;
  procedures: Code[];
  diagnoses: EncounterDiagnosis[];
  diagnosisCodes: Array<{ code: string; description: string }>;
  existingCharges: Charge[];
  nextSequence: number;
}) {
  const router = useRouter();
  const [dxSearch, setDxSearch] = useState('');
  const [selectedDx, setSelectedDx] = useState('');
  const [cptCode, setCptCode] = useState(procedures[0]?.code ?? '');
  const [modifiers, setModifiers] = useState('');
  const [units, setUnits] = useState(1);
  const [chargeAmount, setChargeAmount] = useState(procedures[0]?.defaultCharge ?? 0);
  const [pointers, setPointers] = useState('1');
  const [error, setError] = useState('');
  const filteredDx = useMemo(
    () =>
      diagnosisCodes
        .filter((d) => `${d.code} ${d.description}`.toLowerCase().includes(dxSearch.toLowerCase()))
        .slice(0, 8),
    [diagnosisCodes, dxSearch],
  );
  const total = existingCharges.reduce(
    (sum, charge) => sum + charge.chargeAmount * charge.units,
    0,
  );

  async function post(body: object) {
    setError('');
    const response = await fetch(`/api/encounters/${encounterId}/charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Unable to update encounter.');
    router.refresh();
  }
  async function addDiagnosis() {
    try {
      await post({ action: 'add-diagnosis', diagnosisCode: selectedDx, sequence: nextSequence });
      setSelectedDx('');
      setDxSearch('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add diagnosis.');
    }
  }
  async function addCharge(event: React.FormEvent) {
    event.preventDefault();
    try {
      await post({
        action: 'add-charge',
        cptCode,
        modifiers,
        units,
        chargeAmount,
        diagnosisPointers: pointers,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add charge.');
    }
  }
  async function createClaim() {
    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create claim.');
      router.push(`/claims/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create claim.');
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Diagnoses</h2>
          <div className="mt-4 flex gap-2">
            <input
              value={dxSearch}
              onChange={(e) => setDxSearch(e.target.value)}
              placeholder="Search ICD-10 code or description"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addDiagnosis}
              disabled={!selectedDx}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {dxSearch && (
            <div className="mt-1 rounded-lg border border-slate-200 bg-white">
              {filteredDx.map((dx) => (
                <button
                  type="button"
                  key={dx.code}
                  onClick={() => {
                    setSelectedDx(dx.code);
                    setDxSearch(`${dx.code} · ${dx.description}`);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${selectedDx === dx.code ? 'bg-blue-50' : ''}`}
                >
                  {dx.code} · {dx.description}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 space-y-2">
            {diagnoses.map((dx) => (
              <div
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                key={dx.id}
              >
                <span className="font-bold text-blue-700">{dx.sequence}</span>
                <span className="font-medium">{dx.diagnosisCode}</span>
                <span className="text-slate-500">{dx.diagnosis.description}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Add charge line</h2>
          <form onSubmit={addCharge} className="mt-4 space-y-3">
            <select
              value={cptCode}
              onChange={(e) => {
                setCptCode(e.target.value);
                setChargeAmount(
                  procedures.find((p) => p.code === e.target.value)?.defaultCharge ?? 0,
                );
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {procedures.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.description}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Modifiers
                <input
                  value={modifiers}
                  onChange={(e) => setModifiers(e.target.value)}
                  placeholder="25"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Units
                <input
                  type="number"
                  min="1"
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Charge
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              Diagnosis pointers
              <input
                value={pointers}
                onChange={(e) => setPointers(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
              Add charge line
            </button>
          </form>
        </section>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Charge lines</h2>
          <div className="text-lg font-bold tabular-nums text-blue-700">${total.toFixed(2)}</div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">CPT</th>
              <th className="px-5 py-3">Modifiers</th>
              <th className="px-5 py-3">Units</th>
              <th className="px-5 py-3 text-right">Charge</th>
              <th className="px-5 py-3">Dx pointers</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {existingCharges.map((charge) => (
              <tr className="border-t border-slate-100" key={charge.id}>
                <td className="px-5 py-3 font-semibold">{charge.cptCode}</td>
                <td className="px-5 py-3">{charge.modifiers || '—'}</td>
                <td className="px-5 py-3">{charge.units}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  ${(charge.chargeAmount * charge.units).toFixed(2)}
                </td>
                <td className="px-5 py-3">{charge.diagnosisPointers}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => post({ action: 'remove-charge', chargeLineId: charge.id })}
                    className="text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={createClaim}
            disabled={!existingCharges.length}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Create claim
          </button>
        </div>
      </section>
    </div>
  );
}
