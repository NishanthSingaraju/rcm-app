'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Activity, Check, ChevronRight, ExternalLink, FileText, X } from 'lucide-react';
import type { PolicyChange } from '@/lib/policy-service';

export const dateLabel = (value: string | null, long = false) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        month: long ? 'long' : 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'Not specified';
export const moneyLabel = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export function PayerMark({ payer, small = false }: { payer: string; small?: boolean }) {
  const names: Record<string, [string, string]> = {
    UnitedHealthcare: ['U', 'uhc'],
    Aetna: ['a', 'aetna'],
    Cigna: ['ci', 'cigna'],
    Humana: ['H', 'humana'],
    Anthem: ['A', 'anthem'],
    'CMS / Medicare': ['M', 'cms'],
  };
  const [mark, style] = names[payer] ?? [payer.slice(0, 2).toUpperCase(), 'generic'];
  return (
    <span aria-hidden="true" className={`payer-mark ${style} ${small ? 'small' : ''}`}>
      {mark}
    </span>
  );
}

export function Priority({ value }: { value: string }) {
  return (
    <span className={`priority priority-${value.toLowerCase()}`}>
      <span />
      {value === 'Review' ? 'Needs review' : `${value} impact`}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pp-empty">
      <span className="empty-icon">
        <FileText size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Dialog({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const elements = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`pp-overlay ${wide ? 'drawer-overlay' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        className={wide ? 'pp-drawer' : 'pp-dialog'}
      >
        <div className="dialog-top">
          <span>{title}</span>
          <button className="icon-button" aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PolicyRow({
  change,
  matches,
  open,
}: {
  change: PolicyChange;
  matches: number;
  open: () => void;
}) {
  return (
    <button className={`policy-row ${change.reviewed ? 'reviewed' : ''}`} onClick={open}>
      <div className="policy-identity">
        <PayerMark payer={change.payer} />
        <div>
          <div className="policy-meta">
            {change.payer}
            <span>·</span>
            {change.category}
          </div>
          <h3>{change.title}</h3>
          <div className="policy-tags">
            {change.codes
              .split(',')
              .filter(Boolean)
              .slice(0, 3)
              .map((code) => (
                <span className="code-tag" key={code}>
                  {code}
                </span>
              ))}
            {change.codes.split(',').length > 3 && (
              <span className="extra-codes">+{change.codes.split(',').length - 3}</span>
            )}
            {matches > 0 && (
              <span className="match-tag">
                <Activity size={12} />
                {matches} in chargemaster
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="policy-date">
        <span>Effective {dateLabel(change.effectiveAt)}</span>
        <Priority value={change.priority} />
      </div>
      <span className="row-end">
        {change.reviewed ? <Check size={17} /> : <ChevronRight size={18} />}
      </span>
    </button>
  );
}

export function SourceLink({
  url,
  children = 'View original source',
}: {
  url: string;
  children?: ReactNode;
}) {
  return (
    <a className="text-link" href={url} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}
