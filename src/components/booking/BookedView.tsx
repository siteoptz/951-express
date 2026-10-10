import { bookingCopy as t } from '@/content/booking';
import type { BookingView } from '@/lib/booking-view';
import { money } from '@/lib/format';

/** "You're booked!": shown in the modal and on the fallback page. */
export function BookedView({ view, actions }: { view: BookingView; actions: React.ReactNode }) {
  const c = t.booked;
  const rows: [string, string][] = [
    [c.vehicle, view.vehicle],
    [c.route, view.routeName],
    [c.week, view.weekLabel],
    [c.pickup, view.pickupPlace],
    [c.delivery, view.deliveryPlace],
    [c.load, view.loadType],
  ];
  return (
    <div role="status">
      <p className="rounded-lg bg-success-dark px-4 py-3 text-xl font-extrabold text-white">
        ✓ {c.heading}
      </p>
      <p className="mt-4 text-muted">{c.intro}</p>
      <p className="mt-3 text-sm">
        {c.reference}: <strong className="tracking-wider">{view.ref}</strong>
      </p>

      <dl className="mt-4 divide-y divide-black/10 rounded-lg border border-black/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{c.deposit}</dt>
          <dd className="text-right font-semibold">{money(view.depositCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="font-semibold">{c.balance}</dt>
          <dd className="text-right text-lg font-extrabold">{money(view.balanceCents)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted">
        {view.email ? c.emailNote.replace('{email}', view.email) : c.emailNoteGeneric}
      </p>
      <div className="mt-5">{actions}</div>
    </div>
  );
}
