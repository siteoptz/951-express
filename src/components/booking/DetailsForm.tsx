'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { regionLabels, type Region } from '@/config/routes';
import { bookingCopy as t } from '@/content/booking';
import type { BookingView } from '@/lib/booking-view';
import { digitsOnly } from '@/lib/booking-form';
import { step3Schema } from '@/lib/schemas';
import { useZipCheck } from './useZipCheck';

export type DetailsContext = {
  pickupZip: string;
  deliveryZip: string;
  pickupRegion: Region;
  deliveryRegion: Region;
  payerEmail: string | null;
  weekLabel: string;
};

/** Address text boxes. `city` and `state` are null until the customer types, so a ZIP lookup can suggest them. */
type AddrState = {
  street: string;
  street2: string;
  city: string | null;
  state: string | null;
  zip: string;
};
const emptyAddr = (zip = ''): AddrState => ({
  street: '',
  street2: '',
  city: null,
  state: null,
  zip,
});

const inputClass =
  'mt-1 w-full rounded-lg border-2 border-black/15 px-4 py-3 text-base focus:border-navy aria-[invalid=true]:border-danger';

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function AddressFields({
  legend,
  prefix,
  value,
  onChange,
  errors,
  zipHint,
  zipError,
  suggestion,
  readOnly,
}: {
  legend: string;
  prefix: 'home' | 'pickup' | 'delivery';
  value: AddrState;
  onChange: (next: AddrState) => void;
  errors: Record<string, string>;
  zipHint?: string;
  zipError?: string;
  suggestion?: { city: string | null; state: string | null };
  readOnly?: boolean;
}) {
  const id = useId();
  const key = (f: string) => `${prefix === 'home' ? 'address' : `${prefix}Address`}.${f}`;
  const cityValue = value.city ?? suggestion?.city ?? '';
  const stateValue = value.state ?? suggestion?.state ?? '';
  const set = (patch: Partial<AddrState>) => onChange({ ...value, ...patch });
  const base = { readOnly, 'aria-readonly': readOnly || undefined };
  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-xl font-extrabold uppercase">{legend}</legend>
      <Field id={`${id}-street`} label={t.details.street} error={errors[key('street')]}>
        <input
          id={`${id}-street`}
          {...base}
          autoComplete={`section-${prefix} street-address`}
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
          aria-invalid={!!errors[key('street')]}
          aria-describedby={errors[key('street')] ? `${id}-street-err` : undefined}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-street2`} label={t.details.street2}>
        <input
          id={`${id}-street2`}
          {...base}
          autoComplete={`section-${prefix} address-line2`}
          value={value.street2}
          onChange={(e) => set({ street2: e.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
        <Field id={`${id}-city`} label={t.details.city} error={errors[key('city')]}>
          <input
            id={`${id}-city`}
            {...base}
            autoComplete={`section-${prefix} address-level2`}
            value={cityValue}
            onChange={(e) => set({ city: e.target.value })}
            aria-invalid={!!errors[key('city')]}
            aria-describedby={errors[key('city')] ? `${id}-city-err` : undefined}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-state`} label={t.details.state} error={errors[key('state')]}>
          <input
            id={`${id}-state`}
            {...base}
            autoComplete={`section-${prefix} address-level1`}
            maxLength={2}
            value={stateValue}
            onChange={(e) => set({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
            aria-invalid={!!errors[key('state')]}
            aria-describedby={errors[key('state')] ? `${id}-state-err` : undefined}
            className={`${inputClass} uppercase`}
          />
        </Field>
      </div>
      <Field
        id={`${id}-zip`}
        label={t.details.zip}
        error={zipError ?? errors[key('zip')]}
        hint={zipHint}
      >
        <input
          id={`${id}-zip`}
          {...base}
          inputMode="numeric"
          autoComplete={`section-${prefix} postal-code`}
          value={value.zip}
          onChange={(e) => set({ zip: digitsOnly(e.target.value) })}
          aria-invalid={!!(zipError ?? errors[key('zip')])}
          aria-describedby={(zipError ?? errors[key('zip')]) ? `${id}-zip-err` : undefined}
          className={inputClass}
        />
      </Field>
    </fieldset>
  );
}

const resolved = (a: AddrState, s?: { city: string | null; state: string | null }) => ({
  street: a.street.trim(),
  street2: a.street2.trim() || undefined,
  city: (a.city ?? s?.city ?? '').trim(),
  state: (a.state ?? s?.state ?? '').trim(),
  zip: a.zip,
});

/** Region problems for an address ZIP, from the same /api/zip-check the first step uses. */
function useRegionCheck(zip: string, expected: Region, side: 'pickup' | 'delivery') {
  const check = useZipCheck(zip);
  const label = regionLabels[expected];
  let error: string | undefined;
  if (check.status === 'done') {
    if (!check.data.served || !check.data.region)
      error = t.details.zipNotServed
        .replace('{zip}', zip)
        .replace('{side}', side)
        .replace('{region}', label);
    else if (check.data.region !== expected)
      error = t.details.zipWrongRegion
        .replace('{actual}', regionLabels[check.data.region])
        .replace('{side}', side)
        .replace('{region}', label);
  }
  const suggestion =
    check.status === 'done' ? { city: check.data.city, state: check.data.state } : undefined;
  return {
    error,
    pending: check.status === 'loading',
    unknown: check.status === 'error',
    suggestion,
  };
}

export function DetailsForm({
  token,
  ctx,
  onDone,
}: {
  token: string;
  ctx: DetailsContext;
  onDone: (view: BookingView) => void;
}) {
  const uid = useId();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(ctx.payerEmail ?? '');
  const [home, setHome] = useState<AddrState>(emptyAddr());
  const [same, setSame] = useState(false);
  const [pickupOwn, setPickup] = useState<AddrState>(emptyAddr(ctx.pickupZip));
  const [delivery, setDelivery] = useState<AddrState>(emptyAddr(ctx.deliveryZip));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** Editing a field clears whatever error was shown for it (and for its address group), so no stale message lingers. */
  const clear = (prefix: string) =>
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))),
    );

  const pickup = same ? home : pickupOwn;
  const pickupCheck = useRegionCheck(pickup.zip, ctx.pickupRegion, 'pickup');
  const deliveryCheck = useRegionCheck(delivery.zip, ctx.deliveryRegion, 'delivery');
  const homeCheck = useZipCheck(home.zip); // only to suggest a city and state
  const homeSuggestion =
    homeCheck.status === 'done'
      ? { city: homeCheck.data.city, state: homeCheck.data.state }
      : undefined;

  const fieldMessage = (path: string): string => {
    if (/email/.test(path)) return t.details.invalidEmail;
    if (/phone/.test(path)) return t.details.invalidPhone;
    if (/state/.test(path)) return t.details.invalidState;
    if (/zip/.test(path)) return t.details.invalidZip;
    return t.details.required;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const body = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: resolved(home, homeSuggestion),
      pickupAddress: resolved(pickup, pickupCheck.suggestion),
      deliveryAddress: resolved(delivery, deliveryCheck.suggestion),
      notes: notes.trim() || undefined,
    };
    const parsed = step3Schema.safeParse(body);
    const next: Record<string, string> = {};
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        next[issue.path.join('.')] ??= fieldMessage(issue.path.join('.'));
    if (pickupCheck.error) next['pickupAddress.zip'] = pickupCheck.error;
    if (deliveryCheck.error) next['deliveryAddress.zip'] = deliveryCheck.error;
    setErrors(next);
    if (Object.keys(next).length) return setFormError(t.details.fixErrors);

    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${token}/details`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field) setErrors({ [data.field]: data.error });
        return setFormError(data.error ?? t.genericError);
      }
      onDone(data.confirmation as BookingView);
    } catch {
      setFormError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  const pending = pickupCheck.pending || deliveryCheck.pending;
  return (
    <form onSubmit={submit} noValidate className="space-y-6" aria-labelledby={`${uid}-h`}>
      <div>
        <p className="rounded-lg bg-success-dark px-4 py-3 font-bold text-white">
          {t.details.banner.replace('{week}', ctx.weekLabel)}
        </p>
        <h3 id={`${uid}-h`} className="mt-5 font-display text-2xl font-extrabold uppercase">
          {t.details.heading}
        </h3>
        <p className="mt-1 text-muted">{t.details.intro}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-extrabold uppercase">{t.details.you}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-fn`} label={t.details.firstName} error={errors.firstName}>
            <input
              id={`${uid}-fn`}
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => (setFirstName(e.target.value), clear('firstName'))}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? `${uid}-fn-err` : undefined}
              className={inputClass}
            />
          </Field>
          <Field id={`${uid}-ln`} label={t.details.lastName} error={errors.lastName}>
            <input
              id={`${uid}-ln`}
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => (setLastName(e.target.value), clear('lastName'))}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? `${uid}-ln-err` : undefined}
              className={inputClass}
            />
          </Field>
        </div>
        <Field id={`${uid}-ph`} label={t.details.phone} error={errors.phone}>
          <input
            id={`${uid}-ph`}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => (setPhone(e.target.value), clear('phone'))}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? `${uid}-ph-err` : undefined}
            className={inputClass}
          />
        </Field>
        <Field
          id={`${uid}-em`}
          label={t.details.email}
          error={errors.email}
          hint={t.details.emailHint}
        >
          <input
            id={`${uid}-em`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => (setEmail(e.target.value), clear('email'))}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${uid}-em-err` : undefined}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <AddressFields
        legend={t.details.home}
        prefix="home"
        value={home}
        onChange={setHome}
        errors={errors}
        suggestion={homeSuggestion}
      />

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={same}
            onChange={(e) => (setSame(e.target.checked), clear('pickupAddress.'))}
            className="h-5 w-5 accent-navy"
          />
          {t.details.sameAsHome}
        </label>
        <AddressFields
          legend={t.details.pickup}
          prefix="pickup"
          value={pickup}
          onChange={(a) => (setPickup(a), clear('pickupAddress.'))}
          errors={errors}
          readOnly={same}
          suggestion={pickupCheck.suggestion}
          zipError={pickupCheck.error ?? errors['pickupAddress.zip']}
          zipHint={t.details.zipLocked
            .replace('{zip}', ctx.pickupZip)
            .replace('{region}', regionLabels[ctx.pickupRegion])}
        />
      </div>

      <AddressFields
        legend={t.details.delivery}
        prefix="delivery"
        value={delivery}
        onChange={(a) => (setDelivery(a), clear('deliveryAddress.'))}
        errors={errors}
        suggestion={deliveryCheck.suggestion}
        zipError={deliveryCheck.error ?? errors['deliveryAddress.zip']}
        zipHint={t.details.zipLocked
          .replace('{zip}', ctx.deliveryZip)
          .replace('{region}', regionLabels[ctx.deliveryRegion])}
      />

      <Field id={`${uid}-notes`} label={t.details.notes} hint={t.details.notesHint}>
        <textarea
          id={`${uid}-notes`}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 font-semibold text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || pending}>
        {busy ? t.details.submitting : t.details.submit}
      </Button>
    </form>
  );
}
