'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { regionLabels, type Region } from '@/config/routes';
import { bookingCopy as t } from '@/content/booking';
import type { BookingView } from '@/lib/booking-view';
import { digitsOnly } from '@/lib/booking-form';
import { step3Schema } from '@/lib/schemas';
import { useZipCheck } from './useZipCheck';
import { zipInputAttrs } from '@/lib/zip-input';

export type DetailsContext = {
  pickupZip: string;
  deliveryZip: string;
  pickupRegion: Region;
  deliveryRegion: Region;
  payerEmail: string | null;
  weekLabel: string;
};

/**
 * Address text boxes. `city` is null until the customer types, so the ZIP lookup can fill it in. There is no state box:
 * the state always comes from the ZIP, on the server.
 */
type AddrState = {
  street: string;
  street2: string;
  city: string | null;
  zip: string;
};
const emptyAddr = (zip = ''): AddrState => ({
  street: '',
  street2: '',
  city: null,
  zip,
});

/** What the ZIP lookup says about an address: where it is, and whether it is in one of our regions. */
type Place = {
  city: string | null;
  state: string | null;
  stateName: string | null;
  region: Region | null;
};

const inputClass =
  'mt-1 w-full rounded-lg border-2 border-black/15 px-4 py-3 text-base focus:border-navy aria-[invalid=true]:border-danger';

type ContactState = { name: string; phone: string };
/** The contact to send, or nothing when the customer is the contact. A ticked box with blanks is sent, so the form says what is missing. */
const contactBody = (c: ContactState | null) =>
  c ? { name: c.name.trim(), phone: c.phone.trim() } : undefined;

/** A checkbox that reveals a name and phone for someone other than the customer. */
function ContactToggle({
  uid,
  label,
  value,
  onChange,
  errors,
  path,
}: {
  uid: string;
  label: string;
  value: ContactState | null;
  onChange: (v: ContactState | null) => void;
  errors: Record<string, string>;
  path: string;
}) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => onChange(e.target.checked ? { name: '', phone: '' } : null)}
          className="h-5 w-5 accent-navy"
        />
        {label}
      </label>
      {value && (
        <div className="grid grid-cols-1 gap-3 pl-8 sm:grid-cols-2">
          <Field id={`${uid}-name`} label={t.details.contactName} error={errors[`${path}.name`]}>
            <input
              id={`${uid}-name`}
              value={value.name}
              autoComplete="off"
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              aria-invalid={!!errors[`${path}.name`]}
              aria-describedby={errors[`${path}.name`] ? `${uid}-name-err` : undefined}
              className={inputClass}
            />
          </Field>
          <Field id={`${uid}-phone`} label={t.details.contactPhone} error={errors[`${path}.phone`]}>
            <input
              id={`${uid}-phone`}
              type="tel"
              value={value.phone}
              autoComplete="off"
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              aria-invalid={!!errors[`${path}.phone`]}
              aria-describedby={errors[`${path}.phone`] ? `${uid}-phone-err` : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

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
  place,
  readOnly,
}: {
  legend: string;
  prefix: 'home' | 'pickup' | 'delivery';
  value: AddrState;
  onChange: (next: AddrState) => void;
  errors: Record<string, string>;
  zipHint?: string;
  zipError?: string;
  place?: Place;
  readOnly?: boolean;
}) {
  const id = useId();
  const key = (f: string) => `${prefix === 'home' ? 'address' : `${prefix}Address`}.${f}`;
  const cityValue = value.city ?? place?.city ?? '';
  const stateText = place?.stateName
    ? t.details.stateFromZip.replace('{state}', place.stateName)
    : '';
  // "Delivery: Mount Airy, MD · East region"
  const placeText = place?.state
    ? t.details.placeLine
        .replace('{side}', t.details.sides[prefix])
        .replace('{place}', place.city ? `${place.city}, ${place.state}` : place.state) +
      (place.region ? t.details.regionSuffix.replace('{region}', regionLabels[place.region]) : '')
    : '';
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
      <Field
        id={`${id}-city`}
        label={t.details.city}
        error={errors[key('city')]}
        hint={place?.city ? t.details.cityHint : undefined}
      >
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
      <Field id={`${id}-state`} label={t.details.state}>
        <input
          id={`${id}-state`}
          readOnly
          aria-readonly="true"
          tabIndex={-1}
          value={stateText}
          placeholder={t.details.statePlaceholder}
          data-testid={`${prefix}-state`}
          className={`${inputClass} cursor-not-allowed bg-soft text-ink`}
        />
      </Field>
      <Field
        id={`${id}-zip`}
        label={t.details.zip}
        error={zipError ?? errors[key('zip')]}
        hint={zipHint}
      >
        <input
          id={`${id}-zip`}
          {...base}
          {...zipInputAttrs}
          autoComplete={`section-${prefix} postal-code`}
          value={value.zip}
          // The ZIP decides the city and the state, so a new ZIP starts over with its own city.
          onChange={(e) => set({ zip: digitsOnly(e.target.value), city: null })}
          aria-invalid={!!(zipError ?? errors[key('zip')])}
          aria-describedby={(zipError ?? errors[key('zip')]) ? `${id}-zip-err` : undefined}
          className={inputClass}
        />
      </Field>
      {placeText && (
        <p data-testid={`${prefix}-place`} className="text-sm font-bold text-navy">
          {placeText}
        </p>
      )}
    </fieldset>
  );
}

const resolved = (a: AddrState, p?: Place) => ({
  street: a.street.trim(),
  street2: a.street2.trim() || undefined,
  city: (a.city ?? p?.city ?? '').trim(),
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
  const place: Place | undefined =
    check.status === 'done'
      ? {
          city: check.data.city,
          state: check.data.state,
          stateName: check.data.stateName,
          region: check.data.region,
        }
      : undefined;
  return {
    error,
    pending: check.status === 'loading',
    unknown: check.status === 'error',
    place,
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
  const [color, setColor] = useState('');
  const [vin, setVin] = useState('');
  const [pickupContact, setPickupContact] = useState<ContactState | null>(null);
  const [deliveryContact, setDeliveryContact] = useState<ContactState | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** Set when the server says a city does not match its ZIP: the customer can fix it or confirm it. */
  const [needsConfirm, setNeedsConfirm] = useState(false);
  /** Editing a field clears whatever error was shown for it (and for its address group), so no stale message lingers. */
  const clear = (prefix: string) => {
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))),
    );
    if (/ddress/.test(prefix)) setNeedsConfirm(false);
  };

  const pickup = same ? home : pickupOwn;
  const pickupCheck = useRegionCheck(pickup.zip, ctx.pickupRegion, 'pickup');
  const deliveryCheck = useRegionCheck(delivery.zip, ctx.deliveryRegion, 'delivery');
  const homeCheck = useZipCheck(home.zip); // only to show the place, the state, and the region
  const homePlace: Place | undefined =
    homeCheck.status === 'done'
      ? {
          city: homeCheck.data.city,
          state: homeCheck.data.state,
          stateName: homeCheck.data.stateName,
          region: homeCheck.data.region,
        }
      : undefined;

  const fieldMessage = (path: string): string => {
    if (/email/.test(path)) return t.details.invalidEmail;
    if (/vin/.test(path)) return t.details.invalidVin;
    if (/phone/.test(path)) return t.details.invalidPhone;
    if (/zip/.test(path)) return t.details.invalidZip;
    return t.details.required;
  };

  async function submit(e: React.FormEvent | null, confirmAddresses = false) {
    e?.preventDefault();
    setFormError(null);
    const body = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: resolved(home, homePlace),
      pickupAddress: resolved(pickup, pickupCheck.place),
      deliveryAddress: resolved(delivery, deliveryCheck.place),
      notes: notes.trim() || undefined,
      vehicleColor: color.trim() || undefined,
      vin: vin.trim() || undefined,
      pickupContact: contactBody(pickupContact),
      deliveryContact: contactBody(deliveryContact),
      ...(confirmAddresses ? { confirmAddresses: true } : {}),
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
        if (data.reason === 'city_zip_mismatch' && Array.isArray(data.mismatches)) {
          // Show each message on its city box, and let the customer confirm the address as written.
          setErrors(
            Object.fromEntries(
              (data.mismatches as { field: string; message: string }[]).map((m) => [
                m.field,
                m.message,
              ]),
            ),
          );
          setNeedsConfirm(true);
          return;
        }
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
        onChange={(a) => (setHome(a), clear('address.'))}
        errors={errors}
        place={homePlace}
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
          place={same ? homePlace : pickupCheck.place}
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
        place={deliveryCheck.place}
        zipError={deliveryCheck.error ?? errors['deliveryAddress.zip']}
        zipHint={t.details.zipLocked
          .replace('{zip}', ctx.deliveryZip)
          .replace('{region}', regionLabels[ctx.deliveryRegion])}
      />

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-extrabold uppercase">
          {t.details.vehicleHeading}
        </legend>
        <div className="space-y-3">
          <Field id={`${uid}-color`} label={t.details.vehicleColor}>
            <input
              id={`${uid}-color`}
              value={color}
              maxLength={30}
              onChange={(e) => setColor(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            id={`${uid}-vin`}
            label={t.details.vin}
            error={errors.vin}
            hint={t.details.vinHint}
          >
            <input
              id={`${uid}-vin`}
              value={vin}
              maxLength={17}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => (setVin(e.target.value.toUpperCase()), clear('vin'))}
              aria-invalid={!!errors.vin}
              aria-describedby={errors.vin ? `${uid}-vin-err` : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-extrabold uppercase">
          {t.details.contactsHeading}
        </legend>
        <p className="text-muted">{t.details.contactsHint}</p>
        <ContactToggle
          uid={`${uid}-pc`}
          label={t.details.otherPickupContact}
          value={pickupContact}
          onChange={setPickupContact}
          errors={errors}
          path="pickupContact"
        />
        <ContactToggle
          uid={`${uid}-dc`}
          label={t.details.otherDeliveryContact}
          value={deliveryContact}
          onChange={setDeliveryContact}
          errors={errors}
          path="deliveryContact"
        />
      </fieldset>

      <Field id={`${uid}-notes`} label={t.details.notes} hint={t.details.notesHint}>
        <textarea
          id={`${uid}-notes`}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {needsConfirm && (
        <div
          role="alert"
          data-testid="confirm-address"
          className="space-y-3 rounded-lg border-2 border-danger p-4"
        >
          <p className="font-semibold text-danger">{t.details.confirmAddressNote}</p>
          <Button
            type="button"
            variant="ghostDark"
            onClick={() => void submit(null, true)}
            disabled={busy}
          >
            {t.details.confirmAddress}
          </Button>
        </div>
      )}
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
