'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { company, contactMailto } from '@/config/company';
import { booking } from '@/config/booking';
import { modificationDetailsMaxLength, type QuoteReason } from '@/config/eligibility';
import { largeVehicle, sizeClasses, topDeck } from '@/config/pricing';
import { routes, routingCopy, type Region } from '@/config/routes';
import { bookingCopy as t } from '@/content/booking';
import {
  clearForm,
  decidedClass,
  digitsOnly,
  formQuoteReasons,
  formReducer,
  initialForm,
  isDirty,
  isZip,
  leadPayload,
  loadForm,
  saveForm,
  step1Payload,
  type FormState,
} from '@/lib/booking-form';
import { track } from '@/lib/analytics';
import type { BookingView } from '@/lib/booking-view';
import { routeErrorMessage, shippingLabel } from '@/lib/routing';
import { topDeckSlotFor } from '@/lib/top-deck';
import { RadioPills } from './RadioPills';
import { BookedView } from './BookedView';
import { DetailsForm, type DetailsContext } from './DetailsForm';
import { PaymentStep, type CheckoutInfo } from './PaymentStep';
import { SummaryStep, type NextWeek, type QuoteResponse } from './SummaryStep';
import { useZipCheck, type ZipStatus } from './useZipCheck';
import { WeekPicker, type WeekRow } from './WeekPicker';
import { zipInputAttrs } from '@/lib/zip-input';
import { maxVehicleYear, vehicleYears } from '@/config/vehicles';
import { parseYear } from '@/lib/vehicle-normalize';
import { canonicalMake, canonicalModel, suggestMakes, suggestModels } from '@/lib/vehicle-suggest';
import { SuggestInput } from '@/components/booking/SuggestInput';

type Step = 'form' | 'summary' | 'payment' | 'details' | 'booked' | 'lead_done';
type Load<T> = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; data: T };

const storage = () => (typeof window === 'undefined' ? null : window.sessionStorage);
const callButton = (
  <ButtonLink variant="ghostDark" href={contactMailto} className="mt-2 w-full">
    {t.route.email.replace('{email}', company.contactEmail)}
  </ButtonLink>
);

/** The value, but only after it has stopped changing for `ms` (so typing does not re-run the vehicle checks). */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  const key = JSON.stringify(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(JSON.parse(key) as T), ms);
    return () => clearTimeout(timer);
  }, [key, ms]);
  return settled;
}

const digitsOnly4 = (v: string) => v.replace(/\D/g, '').slice(0, 4);

function useJson<T>(url: string | null, pick: (body: never) => T, reloadKey = 0): Load<T> {
  const [state, setState] = useState<{ url: string; key: number; value: Load<T> } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setState({
          url,
          key: reloadKey,
          value: { status: 'ready', data: pick((await res.json()) as never) },
        });
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setState({ url, key: reloadKey, value: { status: 'error' } });
      });
    return () => controller.abort();
  }, [url, reloadKey, pick]);
  if (!url) return { status: 'idle' };
  return state?.url === url && state.key === reloadKey ? state.value : { status: 'loading' };
}

// Stable picker (a new function each render would refetch).
const pickWeeks = (b: { weeks: WeekRow[] }) => b.weeks;

// The saved answers, with the pickup ZIP from the map's ZIP box applied on top when it differs.
function startingForm(pickupZip?: string): FormState {
  const saved: FormState = { ...initialForm, ...loadForm(storage()) };
  return pickupZip && isZip(pickupZip) && pickupZip !== saved.pickupZip
    ? formReducer(saved, { type: 'set', field: 'pickupZip', value: pickupZip })
    : saved;
}

export default function BookingModal({
  open,
  onClose,
  pickupZip,
}: {
  open: boolean;
  onClose: () => void;
  pickupZip?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, dispatch] = useReducer(formReducer, pickupZip, startingForm);
  const [step, setStep] = useState<Step>('form');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [detailsCtx, setDetailsCtx] = useState<DetailsContext | null>(null);
  const [booked, setBooked] = useState<BookingView | null>(null);
  const [weekFull, setWeekFull] = useState<{
    next: NextWeek;
    reason: 'week_full' | 'top_deck_full';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedPickup, setTouchedPickup] = useState(false);
  const [touchedDelivery, setTouchedDelivery] = useState(false);
  const [weeksReload, setWeeksReload] = useState(0);
  // Set when the server says this vehicle needs a quote but the form had not switched (it re-decides every time).
  const [serverQuote, setServerQuote] = useState<{ key: string; reasons: QuoteReason[] } | null>(
    null,
  );
  const set = useCallback(
    (field: keyof FormState, value: string | boolean | null) =>
      dispatch({ type: 'set', field, value }),
    [],
  );

  // Open and close the native dialog (it provides the focus trap, scroll lock, and Esc).
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      track('quote_started');
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => saveForm(form, storage()), [form]);

  const requestClose = useCallback(() => {
    if (step === 'payment' || step === 'details' || (step === 'form' && isDirty(form)))
      setConfirmClose(true);
    else onClose();
  }, [form, onClose, step]);

  /** Frees the held spot right away (best effort; the hold also expires on its own). */
  const releaseHold = useCallback(() => {
    if (!checkout) return;
    fetch(`/api/bookings/${checkout.publicToken}/release`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => undefined);
    setCheckout(null);
  }, [checkout]);

  const finishAndClose = () => {
    if (step === 'payment') releaseHold();
    if (step === 'lead_done' || step === 'booked' || step === 'details') {
      dispatch({ type: 'reset' });
      clearForm(storage());
      setStep('form');
    }
    setConfirmClose(false);
    onClose();
  };

  // ZIP checks.
  const pickup = useZipCheck(form.pickupZip);
  const delivery = useZipCheck(form.deliveryZip);
  const pickupRegion: Region | null =
    pickup.status === 'done' && pickup.data.served ? pickup.data.region : null;
  const deliveryRegion: Region | null =
    delivery.status === 'done' && delivery.data.served ? delivery.data.region : null;
  const routeOk = !!pickupRegion && !!deliveryRegion && pickupRegion !== deliveryRegion;
  const route = routeOk ? routes.find((r) => r.pickupRegion === pickupRegion)! : null;

  const pickupMessage = zipMessage(
    pickup,
    form.pickupZip,
    'pickup',
    null,
    touchedPickup && form.pickupZip.length > 0 && !isZip(form.pickupZip),
  );
  const deliveryMessage = zipMessage(
    delivery,
    form.deliveryZip,
    'delivery',
    pickupRegion,
    touchedDelivery && form.deliveryZip.length > 0 && !isZip(form.deliveryZip),
  );

  const lastRoute = useRef<string | null>(null);
  useEffect(() => {
    if (route && lastRoute.current !== route.id) track('route_qualified', { route: route.id });
    lastRoute.current = route?.id ?? null;
  }, [route]);
  const rejectedZip = useRef('');
  useEffect(() => {
    const rejected =
      (pickupMessage?.rejected ? form.pickupZip : '') ||
      (deliveryMessage?.rejected ? form.deliveryZip : '');
    if (rejected && rejected !== rejectedZip.current) track('route_rejected', { zip: rejected });
    rejectedZip.current = rejected;
  }, [pickupMessage?.rejected, deliveryMessage?.rejected, form.pickupZip, form.deliveryZip]);

  // The vehicle is three plain typed fields. We wait for a short pause in typing before classifying, so the size
  // chip, the size cards, and the questions below do not flicker with every key.
  const typed = { year: form.year, make: form.make, model: form.model };
  const settled = useSettled(typed, 450);
  const vehicleSettled =
    settled.year === typed.year && settled.make === typed.make && settled.model === typed.model;
  const vForm: FormState = { ...form, ...settled };
  const { classified, decided } = decidedClass(vForm);
  const vehicleComplete =
    parseYear(vForm.year) !== null && !!vForm.make.trim() && !!vForm.model.trim();
  const yearText = form.year.trim();
  const yearError = yearText.length === 4 && parseYear(yearText) === null;
  // The next empty (or invalid) field gets the orange ring.
  const nextField: 'year' | 'make' | 'model' | null =
    parseYear(yearText) === null
      ? 'year'
      : !form.make.trim()
        ? 'make'
        : !form.model.trim()
          ? 'model'
          : null;
  // Anything that cannot be booked online switches the whole form to the personalized quote request.
  const answersKey = JSON.stringify([
    vForm.year,
    vForm.make,
    vForm.model,
    form.selectedClass,
    form.operable,
    form.modified,
    form.highValue,
  ]);
  const formReasons = formQuoteReasons(vForm);
  const reasons =
    formReasons.length > 0
      ? formReasons
      : serverQuote?.key === answersKey
        ? serverQuote.reasons
        : [];
  const isQuote = reasons.length > 0;
  // An exotic vehicle goes straight to the quote form, so there is no size to pick.
  const needsClassPick = vehicleComplete && !classified && !reasons.includes('exotic');

  // Weeks.
  const weeksUrl = route && (decided || isQuote) ? `/api/availability?route=${route.id}` : null;
  const weeks = useJson<WeekRow[]>(weeksUrl, pickWeeks, weeksReload);
  useEffect(() => {
    if (weeks.status === 'ready' && form.weekStart) {
      const w = weeks.data.find((x) => x.start === form.weekStart);
      if (!w || w.closed || w.remaining < 1) set('weekStart', '');
    }
  }, [weeks, form.weekStart, set]);

  // Top-deck slots left for the selected week, for this vehicle's kind of slot. Checked again whenever the week
  // or vehicle changes; the server rechecks on /api/quote and /api/checkout.
  const slot = decided && decided !== 'large' ? topDeckSlotFor(decided) : null;
  const selectedWeek =
    weeks.status === 'ready' ? weeks.data.find((x) => x.start === form.weekStart) : undefined;
  const topDeckLeft = slot && selectedWeek ? selectedWeek.topDeck.remaining[slot] : null;
  const topDeckSoldOut = topDeckLeft === 0;
  // When a week or vehicle change takes Top Deck away, the selection drops to Standard and we say so. The notice
  // belongs to that week and vehicle, and it clears as soon as the customer picks a load type again.
  const topDeckKey = `${form.weekStart}|${decided ?? ''}`;
  useEffect(() => {
    if (topDeckSoldOut && form.topDeck) {
      set('topDeck', false);
      set('topDeckSwitched', topDeckKey);
    }
  }, [topDeckSoldOut, form.topDeck, topDeckKey, set]);
  const showTopDeckSwitched = form.topDeckSwitched === topDeckKey && !form.topDeck;

  // Nothing is sent while the customer is still typing the vehicle.
  const payload = vehicleSettled ? step1Payload(form) : null;
  const lead = vehicleSettled ? leadPayload(form) : null;

  async function submitQuote(override: Partial<FormState> = {}) {
    const payload = step1Payload({ ...form, ...override });
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t.genericError);
        if (body.reason === 'week_full' || body.reason === 'week_unavailable') {
          set('weekStart', '');
          setWeeksReload((n) => n + 1);
        }
        // Someone took the last top-deck slot: reload the counts, which disables the option and clears it.
        if (body.reason === 'top_deck_full') setWeeksReload((n) => n + 1);
        return;
      }
      if (body.quoteRequired) {
        setServerQuote({ key: answersKey, reasons: body.quoteReasons ?? ['large_vehicle'] });
        return;
      }
      setQuote(body as QuoteResponse);
      setWeekFull(null);
      setStep('summary');
      track('quote_viewed', { route: body.route.id });
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  /** Holds the spot and opens the Stripe session for the deposit. */
  async function startCheckout() {
    const payload = step1Payload(form);
    if (!payload) return;
    setBusy(true);
    setError(null);
    setWeekFull(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, replacePublicToken: checkout?.publicToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409)
        return setWeekFull({
          next: body.nextAvailableWeek ?? null,
          reason: body.reason === 'top_deck_full' ? 'top_deck_full' : 'week_full',
        });
      if (body.quoteRequired) {
        setServerQuote({ key: answersKey, reasons: body.quoteReasons ?? ['large_vehicle'] });
        setStep('form');
        return;
      }
      if (!res.ok) return setError(body.error ?? t.genericError);
      setCheckout({
        clientSecret: body.clientSecret,
        publicToken: body.publicToken,
        holdExpiresAt: body.holdExpiresAt,
        bookingId: body.bookingId,
      });
      setStep('payment');
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function submitLead() {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lead),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? t.genericError);
      track('lead_submitted', { route: route?.id ?? '' });
      setStep('lead_done');
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  const activeStep =
    step === 'form' || step === 'lead_done' ? 0 : step === 'details' || step === 'booked' ? 2 : 1;
  const inputClass =
    'mt-1 w-full rounded-lg border-2 border-black/15 px-4 py-3 text-base focus:border-navy';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="booking-title"
      onCancel={(e) => {
        e.preventDefault();
        if (confirmClose) setConfirmClose(false);
        else requestClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) requestClose();
      }}
      className={`m-auto w-full max-w-none scroll-pt-32 overflow-y-auto bg-white p-0 sm:h-auto sm:max-h-[90vh] sm:w-[520px] sm:rounded-2xl ${
        // Full-screen on phones, except while paying. Stripe's embedded checkout silently stalls (Pay just sits
        // there) when the modal is tall: it stalled at about 800px and above, on phones and big monitors alike, and
        // paid fine at 760px and below. The payment step is capped at 700px high for margin (it scrolls inside).
        step === 'payment'
          ? 'h-auto max-h-[min(90dvh,700px)] rounded-t-2xl sm:max-h-[min(90vh,700px)]'
          : 'h-full max-h-none'
      }`}
    >
      <div className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="flex items-center justify-between px-5 py-3 sm:px-6">
          <h2 id="booking-title" className="font-display text-2xl font-extrabold uppercase">
            {t.title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t.close}
            className="rounded p-2 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <ol aria-label="Progress" className="flex gap-1 px-5 pb-3 sm:px-6">
          {t.steps.map((label, i) => (
            <li key={label} aria-current={i === activeStep ? 'step' : undefined} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${i <= activeStep ? 'bg-accent' : 'bg-black/10'}`}
              />
              <span
                className={`mt-1 block text-xs ${i === activeStep ? 'font-bold text-ink' : 'text-muted'}`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {confirmClose && (
          <div
            role="alertdialog"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            className="mb-5 rounded-lg border-2 border-accent bg-accent/10 p-4"
          >
            <p id="confirm-title" className="font-bold">
              {t.confirmClose.title}
            </p>
            <p id="confirm-body" className="mt-1 text-sm">
              {step === 'payment'
                ? t.confirmClose.paymentBody
                : step === 'details'
                  ? t.confirmClose.detailsBody
                  : t.confirmClose.body}
            </p>
            <div className="mt-3 flex gap-2">
              <Button autoFocus onClick={() => setConfirmClose(false)}>
                {t.confirmClose.keep}
              </Button>
              <Button variant="ghostDark" onClick={finishAndClose}>
                {t.confirmClose.leave}
              </Button>
            </div>
          </div>
        )}

        {step === 'lead_done' && (
          <div role="status" className="py-6 text-center">
            <p className="font-display text-3xl font-extrabold uppercase">{t.lead.thanksHeading}</p>
            <p className="mt-3 text-muted">{t.lead.thanksBody}</p>
            <Button className="mt-6" onClick={finishAndClose}>
              {t.lead.done}
            </Button>
          </div>
        )}

        {step === 'summary' && quote && (
          <SummaryStep
            quote={quote}
            busy={busy}
            error={error}
            weekFull={weekFull}
            onBack={() => {
              setError(null);
              setWeekFull(null);
              setStep('form');
            }}
            onContinue={() => void startCheckout()}
            onUseNextWeek={(w) => {
              set('weekStart', w.start);
              void submitQuote({ weekStart: w.start });
            }}
          />
        )}

        {step === 'payment' && quote && checkout && (
          <PaymentStep
            quote={quote}
            checkout={checkout}
            onEdit={() => {
              releaseHold();
              setStep('form');
            }}
            onPaid={({ payerEmail }) => {
              clearForm(storage());
              if (pickupRegion && deliveryRegion) {
                setDetailsCtx({
                  pickupZip: form.pickupZip,
                  deliveryZip: form.deliveryZip,
                  pickupRegion,
                  deliveryRegion,
                  payerEmail,
                  weekLabel: quote.week.label,
                });
              }
              setStep('details');
            }}
            onHoldAgain={() => {
              releaseHold();
              setStep('summary');
            }}
          />
        )}

        {step === 'details' && checkout && detailsCtx && (
          <DetailsForm
            token={checkout.publicToken}
            ctx={detailsCtx}
            onDone={(view) => {
              setBooked(view);
              setStep('booked');
            }}
          />
        )}

        {step === 'booked' && booked && (
          <BookedView
            view={booked}
            actions={<Button onClick={finishAndClose}>{t.booked.done}</Button>}
          />
        )}

        {step === 'form' && (
          <form
            noValidate
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (isQuote) void submitLead();
              else void submitQuote();
            }}
          >
            <section aria-labelledby="route-h" className="space-y-4">
              <h3 id="route-h" className="sr-only">
                Route
              </h3>
              <div>
                <label htmlFor="pickup-zip" className="block text-sm font-semibold text-muted">
                  {t.route.pickupLabel}
                </label>
                <input
                  id="pickup-zip"
                  autoFocus
                  {...zipInputAttrs}
                  autoComplete="postal-code"
                  value={form.pickupZip}
                  onChange={(e) => set('pickupZip', digitsOnly(e.target.value))}
                  onBlur={() => setTouchedPickup(true)}
                  aria-describedby="pickup-msg"
                  aria-invalid={!!pickupMessage?.error}
                  className={inputClass}
                />
                <div id="pickup-msg" aria-live="polite">
                  {pickupRegion && (
                    <p className="mt-2 font-bold text-navy">{shippingLabel(pickupRegion)}</p>
                  )}
                  {pickupMessage?.node}
                </div>
              </div>
              <div>
                <label htmlFor="delivery-zip" className="block text-sm font-semibold text-muted">
                  {t.route.deliveryLabel}
                </label>
                <input
                  id="delivery-zip"
                  {...zipInputAttrs}
                  autoComplete="postal-code"
                  disabled={!pickupRegion}
                  value={form.deliveryZip}
                  onChange={(e) => set('deliveryZip', digitsOnly(e.target.value))}
                  onBlur={() => setTouchedDelivery(true)}
                  aria-describedby="delivery-msg"
                  aria-invalid={!!deliveryMessage?.error}
                  className={`${inputClass} disabled:bg-soft`}
                />
                <div id="delivery-msg" aria-live="polite">
                  {pickupRegion && !form.deliveryZip && (
                    <p className="mt-1 text-sm text-muted">
                      {pickupRegion === 'west'
                        ? t.route.deliveryHintWest
                        : t.route.deliveryHintEast}
                    </p>
                  )}
                  {routeOk && (
                    <p className="mt-2 font-semibold text-success-dark">{t.route.qualified}</p>
                  )}
                  {deliveryMessage?.node}
                </div>
              </div>
            </section>

            {routeOk && (
              <section aria-labelledby="vehicle-h" className="space-y-4">
                <h3 id="vehicle-h" className="font-display text-xl font-extrabold uppercase">
                  {t.vehicle.heading}
                </h3>
                {(
                  [
                    ['year', t.vehicle.year, t.vehicle.yearPlaceholder, 'numeric', 4],
                    ['make', t.vehicle.make, t.vehicle.makePlaceholder, 'text', 60],
                    ['model', t.vehicle.model, t.vehicle.modelPlaceholder, 'text', 80],
                  ] as const
                ).map(([field, label, placeholder, mode, max]) => (
                  <div key={field}>
                    <label
                      htmlFor={`vehicle-${field}`}
                      className="block text-sm font-semibold text-muted"
                    >
                      {label}
                    </label>
                    {field === 'year' ? (
                      <input
                        id="vehicle-year"
                        type="text"
                        inputMode={mode}
                        maxLength={max}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={placeholder}
                        value={form.year}
                        onChange={(e) => set('year', digitsOnly4(e.target.value))}
                        aria-invalid={yearError ? true : undefined}
                        aria-describedby={yearError ? 'vehicle-year-error' : undefined}
                        className={`${inputClass} min-h-12 ${
                          nextField === 'year' ? '!border-accent-text ring-4 ring-accent/40' : ''
                        }`}
                      />
                    ) : (
                      <SuggestInput
                        id={`vehicle-${field}`}
                        inputMode={mode}
                        maxLength={max}
                        autoCapitalize="words"
                        spellCheck={false}
                        placeholder={placeholder}
                        value={form[field]}
                        onChange={(v) => set(field, v)}
                        // Leaving the box tidies an exact match ("chevy" -> "Chevrolet", "crv" -> "CR-V").
                        // Text that matches nothing is never changed.
                        onBlur={() => {
                          const fixed =
                            field === 'make'
                              ? canonicalMake(form.make)
                              : canonicalModel(form.make, form.model);
                          if (fixed && fixed !== form[field]) set(field, fixed);
                        }}
                        suggestions={
                          field === 'make'
                            ? suggestMakes(form.make)
                            : suggestModels(form.make, form.model)
                        }
                        countLabel={t.vehicle.suggestionsCount}
                        className={`${inputClass} min-h-12 ${
                          nextField === field ? '!border-accent-text ring-4 ring-accent/40' : ''
                        }`}
                      />
                    )}
                    {field === 'year' && yearError && (
                      <p
                        id="vehicle-year-error"
                        role="alert"
                        className="mt-2 font-semibold text-danger"
                      >
                        {t.vehicle.yearError
                          .replace('{min}', String(vehicleYears.min))
                          .replace('{max}', String(maxVehicleYear()))}
                      </p>
                    )}
                  </div>
                ))}

                {classified && classified !== 'large' && (
                  <p
                    className="inline-block rounded-full bg-navy px-4 py-2 text-sm font-bold text-white"
                    data-testid="size-chip"
                  >
                    {t.vehicle.chip.replace(
                      '{label}',
                      sizeClasses.find((c) => c.id === classified)!.label,
                    )}
                  </p>
                )}
                {classified === 'large' && (
                  <p
                    className="inline-block rounded-full bg-navy px-4 py-2 text-sm font-bold text-white"
                    data-testid="size-chip"
                  >
                    {t.vehicle.chip.replace('{label}', largeVehicle.label)}
                  </p>
                )}
                {needsClassPick && (
                  <fieldset>
                    <legend className="font-semibold">{t.vehicle.unknownHeading}</legend>
                    <p className="text-sm text-muted">{t.vehicle.unknownNote}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        ...sizeClasses.map((c) => ({
                          id: c.id as string,
                          label: c.label,
                          example: c.example,
                        })),
                        { id: 'large', label: t.vehicle.largeLabel, example: largeVehicle.example },
                      ].map((c) => (
                        <label key={c.id} className="block cursor-pointer">
                          <input
                            type="radio"
                            name="size-class"
                            value={c.id}
                            checked={form.selectedClass === c.id}
                            onChange={() => set('selectedClass', c.id)}
                            className="peer sr-only"
                          />
                          <span className="block h-full rounded-lg border-2 border-black/15 px-3 py-2 peer-checked:border-navy peer-checked:bg-navy/5 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent">
                            <span className="block font-bold">{c.label}</span>
                            <span className="block text-sm text-muted">
                              {t.vehicle.cardExample.replace('{example}', c.example)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </section>
            )}

            {routeOk && vehicleComplete && (decided || isQuote) && (
              <section className="space-y-5">
                <RadioPills
                  legend={t.options.highValue}
                  value={form.highValue === null ? null : form.highValue ? 'yes' : 'no'}
                  onChange={(v) => set('highValue', v === 'yes')}
                  options={[
                    { value: 'yes', label: t.options.highValueYes },
                    { value: 'no', label: t.options.highValueNo },
                  ]}
                />
                <RadioPills
                  legend={t.options.operable}
                  value={form.operable === null ? null : form.operable ? 'yes' : 'no'}
                  onChange={(v) => set('operable', v === 'yes')}
                  options={[
                    { value: 'yes', label: t.options.operableYes },
                    { value: 'no', label: t.options.operableNo },
                  ]}
                />
                <RadioPills
                  legend={t.options.modified}
                  value={form.modified === null ? null : form.modified ? 'yes' : 'no'}
                  onChange={(v) => set('modified', v === 'yes')}
                  options={[
                    { value: 'yes', label: t.options.modifiedYes },
                    { value: 'no', label: t.options.modifiedNo },
                  ]}
                />

                {!isQuote && (
                  <>
                    <RadioPills
                      stacked
                      legend={t.options.load}
                      value={form.topDeck ? 'top' : 'standard'}
                      onChange={(v) => set('topDeck', v === 'top')}
                      options={[
                        { value: 'standard', label: t.options.loadStandard },
                        {
                          value: 'top',
                          label: `${t.options.loadTopDeck} (+$${topDeck.surchargeCents / 100})`,
                          disabled: topDeckSoldOut,
                          extra: (
                            <>
                              {topDeckLeft !== null && (
                                <p
                                  data-testid="top-deck-status"
                                  className={`mt-2 px-1 text-sm font-bold ${topDeckSoldOut ? 'text-danger' : 'text-success-dark'}`}
                                >
                                  {topDeckSoldOut
                                    ? t.topDeck.soldOut
                                    : topDeckLeft === 1
                                      ? t.topDeck.oneSpotLeft
                                      : t.topDeck.spotsLeft.replace('{n}', String(topDeckLeft))}
                                </p>
                              )}
                              <ul className="mt-2 list-disc space-y-1 pl-9 pr-2 text-sm text-muted">
                                {topDeck.benefits.map((b) => (
                                  <li key={b}>{b}</li>
                                ))}
                              </ul>
                            </>
                          ),
                        },
                      ]}
                    />
                    {showTopDeckSwitched && (
                      <p
                        role="status"
                        data-testid="top-deck-switched"
                        className="-mt-2 rounded-lg bg-accent/20 px-4 py-3 text-sm font-semibold"
                      >
                        {t.topDeck.switched}
                      </p>
                    )}
                    <div>
                      <RadioPills
                        legend={t.options.personal}
                        value={
                          form.personalItems === null ? null : form.personalItems ? 'yes' : 'no'
                        }
                        onChange={(v) => set('personalItems', v === 'yes')}
                        options={[
                          { value: 'yes', label: t.options.yes },
                          { value: 'no', label: t.options.no },
                        ]}
                      />
                      {form.personalItems && (
                        <p
                          role="note"
                          className="mt-3 rounded-lg bg-accent/20 px-4 py-3 text-sm font-semibold"
                        >
                          {booking.personalItemsNotice}
                        </p>
                      )}
                    </div>
                    {route && (
                      <WeekPicker
                        routeName={route.name}
                        weeks={weeks.status === 'ready' ? weeks.data : []}
                        status={
                          weeks.status === 'ready'
                            ? 'ready'
                            : weeks.status === 'error'
                              ? 'error'
                              : 'loading'
                        }
                        value={form.weekStart}
                        onChange={(s) => set('weekStart', s)}
                        onRetry={() => setWeeksReload((n) => n + 1)}
                      />
                    )}
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.terms}
                        onChange={(e) => set('terms', e.target.checked)}
                        className="mt-1 h-5 w-5 accent-navy"
                      />
                      <span>
                        {t.terms.prefix}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline"
                        >
                          {t.terms.link}
                          <span className="sr-only"> {t.terms.newTab}</span>
                        </a>
                      </span>
                    </label>
                  </>
                )}

                {isQuote && (
                  <section
                    aria-labelledby="lead-h"
                    className="space-y-4 rounded-lg border-2 border-navy/20 p-4"
                  >
                    <h3 id="lead-h" className="font-display text-xl font-extrabold uppercase">
                      {t.lead.heading}
                    </h3>
                    <div className="space-y-2" data-testid="quote-reasons">
                      {[...new Set(reasons.map((r) => t.lead.reasons[r]))].map((message) => (
                        <p key={message} className="text-sm font-semibold text-ink">
                          {message}
                        </p>
                      ))}
                    </div>
                    {form.modified && (
                      <div>
                        <label
                          htmlFor="lead-modifications"
                          className="block text-sm font-semibold text-muted"
                        >
                          {t.lead.modifications}
                        </label>
                        <textarea
                          id="lead-modifications"
                          rows={3}
                          required
                          maxLength={modificationDetailsMaxLength}
                          placeholder={t.lead.modificationsPlaceholder}
                          value={form.modificationDetails}
                          onChange={(e) => set('modificationDetails', e.target.value)}
                          aria-describedby="lead-modifications-count"
                          className={inputClass}
                        />
                        <p id="lead-modifications-count" className="mt-1 text-sm text-muted">
                          {t.lead.modificationsCount
                            .replace('{n}', String(form.modificationDetails.length))
                            .replace('{max}', String(modificationDetailsMaxLength))}
                        </p>
                      </div>
                    )}
                    {(
                      [
                        ['name', t.lead.name, 'text', 'name'],
                        ['phone', t.lead.phone, 'tel', 'tel'],
                        ['email', t.lead.email, 'email', 'email'],
                      ] as const
                    ).map(([field, label, type, auto]) => (
                      <div key={field}>
                        <label
                          htmlFor={`lead-${field}`}
                          className="block text-sm font-semibold text-muted"
                        >
                          {label}
                        </label>
                        <input
                          id={`lead-${field}`}
                          type={type}
                          autoComplete={auto}
                          value={form[field]}
                          onChange={(e) => set(field, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    ))}
                    <div>
                      <label htmlFor="lead-week" className="block text-sm font-semibold text-muted">
                        {t.lead.week}
                      </label>
                      <select
                        id="lead-week"
                        value={form.leadWeek}
                        onChange={(e) => set('leadWeek', e.target.value)}
                        aria-describedby="lead-week-note"
                        className={inputClass}
                      >
                        <option value="">{t.lead.weekNone}</option>
                        {(weeks.status === 'ready' ? weeks.data : []).map((w) => (
                          <option key={w.start} value={w.start}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                      <p id="lead-week-note" className="mt-1 text-sm text-muted">
                        {t.lead.weekNote}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="lead-notes"
                        className="block text-sm font-semibold text-muted"
                      >
                        {t.lead.notes}
                      </label>
                      <textarea
                        id="lead-notes"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </section>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger/10 px-4 py-3 font-semibold text-danger"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || (isQuote ? !lead : !payload)}
                >
                  {isQuote
                    ? busy
                      ? t.lead.submitting
                      : t.lead.submit
                    : busy
                      ? t.submitting
                      : t.submit}
                </Button>
              </section>
            )}
          </form>
        )}
      </div>
    </dialog>
  );
}

type ZipMsg = { node: React.ReactNode; error: boolean; rejected: boolean } | null;

function zipMessage(
  z: ZipStatus,
  zip: string,
  side: 'pickup' | 'delivery',
  pickupRegion: Region | null,
  showInvalid: boolean,
): ZipMsg {
  const alert = (text: string, withCall: boolean, rejected: boolean): ZipMsg => ({
    error: true,
    rejected,
    node: (
      <div role="alert" className="mt-2 text-danger">
        <p className="font-semibold">{text}</p>
        {withCall && callButton}
      </div>
    ),
  });
  if (showInvalid) return alert(routingCopy.invalidZip, false, false);
  if (z.status === 'loading')
    return {
      error: false,
      rejected: false,
      node: <p className="mt-2 text-sm text-muted">{t.route.checking}</p>,
    };
  if (z.status === 'error') return alert(t.route.lookupError, true, false);
  if (z.status !== 'done') return null;
  const d = z.data;
  if (!d.valid) return alert(routingCopy.invalidZip, false, false);
  if (!d.served) {
    return alert(
      routeErrorMessage({
        ok: false,
        reason: side === 'pickup' ? 'pickup_not_served' : 'delivery_not_served',
        zip,
      }),
      true,
      true,
    );
  }
  if (side === 'delivery' && pickupRegion && d.region === pickupRegion) {
    return alert(
      routeErrorMessage({ ok: false, reason: 'same_region', region: pickupRegion }),
      false,
      true,
    );
  }
  return null;
}
