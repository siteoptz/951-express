'use client';

import { bookingCopy } from '@/content/booking';

export type WeekRow = {
  start: string;
  label: string;
  capacity: number;
  taken: number;
  remaining: number;
  closed: boolean;
};

export function WeekPicker({
  routeName,
  weeks,
  status,
  value,
  onChange,
  onRetry,
}: {
  routeName: string;
  weeks: WeekRow[];
  status: 'loading' | 'error' | 'ready';
  value: string;
  onChange: (start: string) => void;
  onRetry: () => void;
}) {
  const c = bookingCopy.weeks;
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-muted">
        {c.heading.replace('{route}', routeName)}
      </legend>
      {status === 'loading' && <p className="mt-2 text-muted">{c.loading}</p>}
      {status === 'error' && (
        <p role="alert" className="mt-2 text-danger">
          {c.error}{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            {c.retry}
          </button>
        </p>
      )}
      {status === 'ready' && (
        <div
          role="radiogroup"
          aria-label={c.heading.replace('{route}', routeName)}
          className="mt-2 flex flex-col gap-2"
        >
          {weeks.map((w) => {
            const unavailable = w.closed || w.remaining < 1;
            const selected = value === w.start;
            const pct =
              w.capacity > 0 ? Math.min(100, Math.round((w.taken / w.capacity) * 100)) : 100;
            const status = w.closed
              ? c.closed
              : unavailable
                ? c.full
                    .replace('{taken}', String(w.taken))
                    .replace('{capacity}', String(w.capacity))
                : w.remaining === 1
                  ? c.oneSpotLeft
                  : c.spotsLeft.replace('{n}', String(w.remaining));
            return (
              <div
                key={w.start}
                role="radio"
                tabIndex={unavailable ? -1 : 0}
                aria-checked={selected}
                aria-disabled={unavailable || undefined}
                aria-label={`${w.label}, ${status}`}
                onClick={() => !unavailable && onChange(w.start)}
                onKeyDown={(e) => {
                  if (!unavailable && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    onChange(w.start);
                  }
                }}
                className={`rounded-lg border-2 px-4 py-3 ${
                  unavailable
                    ? 'cursor-not-allowed border-black/10 bg-soft'
                    : selected
                      ? 'cursor-pointer border-navy bg-navy/5'
                      : 'cursor-pointer border-black/15 hover:border-navy/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`font-semibold ${unavailable ? 'text-danger line-through' : ''}`}
                  >
                    {w.label}
                  </span>
                  <span className={`text-sm font-bold ${unavailable ? 'text-danger' : 'text-ink'}`}>
                    {status}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"
                >
                  <div
                    className={`h-full rounded-full ${unavailable ? 'bg-danger' : 'bg-success'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
