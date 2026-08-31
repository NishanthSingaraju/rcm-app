'use client';

import { useState } from 'react';
import { ActionButton } from './action-button';

type ClaimActionsProps = {
  claimId: string;
  status: string;
  balance: number;
  hasErrors: boolean;
  denialId?: string;
  denialStatus?: string;
};

export function ClaimActions({
  claimId,
  status,
  balance,
  hasErrors,
  denialId,
  denialStatus,
}: ClaimActionsProps) {
  const [amount, setAmount] = useState('');
  const canSubmit = (status === 'DRAFT' || status === 'READY') && !hasErrors;
  const canAppeal = Boolean(
    denialId && denialStatus !== 'WRITTEN_OFF' && denialStatus !== 'RESOLVED',
  );

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Claim actions</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          endpoint={`/api/claims/${claimId}/scrub`}
          label="Scrub"
          disabled={status === 'CLOSED'}
        />
        <ActionButton
          endpoint={`/api/claims/${claimId}/submit`}
          label="Submit"
          variant="primary"
          disabled={!canSubmit}
        />
        <ActionButton
          endpoint={`/api/claims/${claimId}/adjudicate`}
          label="Simulate payer response"
          disabled={status !== 'SUBMITTED'}
        />
        {denialId && (
          <>
            <ActionButton
              endpoint={`/api/denials/${denialId}/appeal`}
              label="Appeal"
              variant="danger"
              disabled={!canAppeal}
              body={{ notes: 'Appeal submitted from claim worklist.' }}
            />
            <ActionButton
              endpoint={`/api/denials/${denialId}/write-off`}
              label="Write off"
              disabled={!canAppeal}
            />
          </>
        )}
      </div>
      <div className="mt-5 flex max-w-md items-end gap-2">
        <label className="flex-1 text-sm text-slate-600">
          Post patient payment
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <ActionButton
          endpoint={`/api/claims/${claimId}/payment`}
          label="Post payment"
          disabled={balance <= 0 || !amount}
          body={{ amount: Number(amount) }}
          variant="primary"
        />
      </div>
    </section>
  );
}
