'use client';

import { Button } from '@/components/ui/Button';
import { bookingCopy } from '@/content/booking';

export type QuoteResponse = {
  route: { id: string; name: string };
  week: { start: string; label: string };
  vehicle: { year: number; make: string; model: string };
  sizeClass: { id: string; label: string };
  loadType: string;
  personalItems: boolean;
  personalItemsNotice: string | null;
  lines: { id: string; label: string; cents: number }[];
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  needsReview: boolean;
};

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

export function SummaryStep({ quote, onBack }: { quote: QuoteResponse; onBack: () => void }) {
  const c = bookingCopy.summary;
  const v = quote.vehicle;
  return (
    <div>
      <h3 className="font-display text-2xl font-extrabold uppercase">{c.heading}</h3>
      <dl className="mt-4 divide-y divide-black/10 rounded-lg border border-black/10">
        {[
          [c.vehicle, `${v.year} ${v.make} ${v.model} (${quote.sizeClass.label})`],
          [c.route, quote.route.name],
          [c.week, quote.week.label],
          [c.load, quote.loadType],
        ].map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{val}</dd>
          </div>
        ))}
      </dl>

      <ul aria-label="Price breakdown" className="mt-4 space-y-2">
        {quote.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-4">
            <span>{l.label}</span>
            <span className="font-semibold">{money(l.cents)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t border-black/10 pt-2 text-lg font-bold">
          <span>{c.total}</span>
          <span>{money(quote.totalCents)}</span>
        </li>
      </ul>

      <div className="mt-4 rounded-lg bg-success-dark px-4 py-3 text-white">
        <div className="flex justify-between gap-4 text-lg font-extrabold">
          <span>{c.deposit}</span>
          <span>{money(quote.depositCents)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-4 text-sm">
          <span>{c.balance}</span>
          <span className="font-bold">{money(quote.balanceCents)}</span>
        </div>
      </div>

      {quote.personalItemsNotice && (
        <p className="mt-3 rounded-lg bg-amber/20 px-4 py-3 text-sm font-semibold">
          {quote.personalItemsNotice}
        </p>
      )}
      {quote.needsReview && <p className="mt-3 text-sm text-muted">{c.review}</p>}

      <Button className="mt-5 w-full" disabled>
        {c.continue}
      </Button>
      <p className="mt-2 text-center text-sm text-muted">{c.continueNote}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full rounded-lg px-4 py-3 font-semibold text-navy underline"
      >
        {c.back}
      </button>
    </div>
  );
}
