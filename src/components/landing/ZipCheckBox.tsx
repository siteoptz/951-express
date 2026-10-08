'use client';

import { useId, useState } from 'react';
import { useBooking } from '@/components/booking/BookingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { company } from '@/config/company';
import { regionLabels, type Region } from '@/config/routes';
import { landing } from '@/content/landing';

type Result =
  | { kind: 'served'; zip: string; place: string | null; region: Region; opposite: Region }
  | { kind: 'not_served'; zip: string }
  | { kind: 'invalid' }
  | { kind: 'error' | 'rate_limited' };

type Api = {
  valid: boolean;
  served: boolean;
  region: Region | null;
  city: string | null;
  state: string | null;
  oppositeRegion: Region | null;
};

export function ZipCheckBox() {
  const t = landing.serviceArea.zipBox;
  const { openBooking } = useBooking();
  const id = useId();
  const [zip, setZip] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const value = zip.trim();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/zip-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ zip: value }),
      });
      if (res.status === 429) return setResult({ kind: 'rate_limited' });
      if (!res.ok) return setResult({ kind: 'error' });
      const data: Api = await res.json();
      const five = value.slice(0, 5);
      if (!data.valid) setResult({ kind: 'invalid' });
      else if (data.served && data.region && data.oppositeRegion) {
        setResult({
          kind: 'served',
          zip: five,
          place: data.city && data.state ? `${data.city}, ${data.state}` : null,
          region: data.region,
          opposite: data.oppositeRegion,
        });
      } else setResult({ kind: 'not_served', zip: five });
    } catch {
      setResult({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const call = (
    <ButtonLink variant="ghostDark" href={company.phoneHref} className="mt-3 w-full">
      {t.call.replace('{phone}', company.phone)}
    </ButtonLink>
  );

  let message: React.ReactNode = null;
  if (result?.kind === 'served') {
    const text = (result.place ? t.served : t.servedNoCity)
      .replace('{place}', result.place ?? '')
      .replace('{zip}', result.zip)
      .replace('{region}', regionLabels[result.region])
      .replace('{opposite}', regionLabels[result.opposite]);
    message = (
      <>
        <p className="font-semibold text-success">{text}</p>
        <Button className="mt-3 w-full" onClick={() => openBooking({ pickupZip: result.zip })}>
          {t.cta}
        </Button>
      </>
    );
  } else if (result?.kind === 'not_served') {
    message = (
      <>
        <p className="font-semibold text-danger">{t.notServed.replace('{zip}', result.zip)}</p>
        {call}
      </>
    );
  } else if (result?.kind === 'invalid') {
    message = <p className="font-semibold text-danger">{t.invalid}</p>;
  } else if (result?.kind === 'error' || result?.kind === 'rate_limited') {
    message = (
      <>
        <p className="font-semibold text-danger">
          {result.kind === 'error' ? t.error : t.rateLimited}
        </p>
        {call}
      </>
    );
  }

  return (
    <form onSubmit={check} className="rounded-2xl bg-white p-6 text-ink shadow-lg" noValidate>
      <h3 className="font-display text-2xl font-extrabold uppercase">{t.heading}</h3>
      <label htmlFor={id} className="mt-4 block text-sm font-semibold text-muted">
        {t.label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          name="zip"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          aria-describedby={`${id}-result`}
          className="min-w-0 flex-1 rounded-lg border-2 border-black/15 px-4 py-3 text-lg tracking-wider focus:border-navy"
        />
        <Button type="submit" disabled={busy || zip.trim() === ''}>
          {busy ? t.checking : t.button}
        </Button>
      </div>
      <div id={`${id}-result`} role="status" aria-live="polite" className="mt-4 min-h-6">
        {message}
      </div>
    </form>
  );
}
