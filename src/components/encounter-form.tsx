'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type EncounterFormProps = {
  patients: Array<{ id: string; mrn: string; firstName: string; lastName: string }>;
  providers: Array<{ id: string; firstName: string; lastName: string; specialty: string }>;
};

export function EncounterForm({ patients, providers }: EncounterFormProps) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(patients[0]?.id ?? '');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [dateOfService, setDateOfService] = useState(new Date().toISOString().slice(0, 10));
  const [placeOfService, setPlaceOfService] = useState('11');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function createEncounter(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, providerId, dateOfService, placeOfService }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create encounter.');
      router.push(`/encounters/${result.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to create encounter.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={createEncounter} className="card max-w-2xl space-y-5 p-6">
      <label className="block text-sm font-medium">
        Patient
        <select
          value={patientId}
          onChange={(event) => setPatientId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.mrn} · {patient.firstName} {patient.lastName}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Provider
        <select
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.firstName} {provider.lastName} · {provider.specialty}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Date of service
          <input
            required
            type="date"
            value={dateOfService}
            onChange={(event) => setDateOfService(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Place of service
          <select
            value={placeOfService}
            onChange={(event) => setPlaceOfService(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="11">11 · Office</option>
            <option value="22">22 · Outpatient</option>
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create encounter'}
      </button>
    </form>
  );
}
