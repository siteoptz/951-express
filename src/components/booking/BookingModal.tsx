'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { company } from '@/config/company';
import { booking } from '@/config/booking';
import { largeVehicle, sizeClasses, topDeck } from '@/config/pricing';
import { routes, routingCopy, type Region } from '@/config/routes';
import { bookingCopy as t } from '@/content/booking';
import {
  clearForm,
  decidedClass,
  digitsOnly,
  formReducer,
  initialForm,
  isDirty,
  isZip,
  leadPayload,
  loadForm,
  saveForm,
  step1Payload,
  yearOptions,
  type FormState,
} from '@/lib/booking-form';
import { track } from '@/lib/analytics';
import { routeErrorMessage, shippingLabel } from '@/lib/routing';
import { Combobox, type Option } from './Combobox';
import { RadioPills } from './RadioPills';
import { SummaryStep, type QuoteResponse } from './SummaryStep';
import { useZipCheck, type ZipStatus } from './useZipCheck';
import { WeekPicker, type WeekRow } from './WeekPicker';

type Step = 'form' | 'summary' | 'lead_done';
type Load<T> = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; data: T };

const storage = () => (typeof window === 'undefined' ? null : window.sessionStorage);
const callButton = (
  <ButtonLink variant="ghostDark" href={company.phoneHref} className="mt-2 w-full">
    {t.route.call.replace('{phone}', company.phone)}
  </ButtonLink>
);

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

// Stable pickers (a new function each render would refetch).
// Stored and sent as the readable name ("Chevrolet"); vPIC matches makes case-insensitively.
const pickMakes = (b: { makes: Option[] }) =>
  b.makes.map((m) => ({ value: m.label, label: m.label }));
const pickModels = (b: { models: string[] }) => b.models.map((m) => ({ value: m, label: m }));
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedPickup, setTouchedPickup] = useState(false);
  const [touchedDelivery, setTouchedDelivery] = useState(false);
  const [weeksReload, setWeeksReload] = useState(0);
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
    if (step === 'form' && isDirty(form)) setConfirmClose(true);
    else onClose();
  }, [form, onClose, step]);

  const finishAndClose = () => {
    if (step === 'lead_done') {
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

  // Vehicle lists.
  const years = useMemo(() => yearOptions(), []);
  const makes = useJson<Option[]>(
    route && form.year ? `/api/vehicles/makes?year=${form.year}` : null,
    pickMakes,
  );
  const models = useJson<Option[]>(
    route && form.year && form.make.trim()
      ? `/api/vehicles/models?year=${form.year}&make=${encodeURIComponent(form.make.trim())}`
      : null,
    pickModels,
  );
  const { classified, decided } = decidedClass(form);
  const vehicleComplete = !!form.year && !!form.make.trim() && !!form.model.trim();
  const needsClassPick = vehicleComplete && !classified;
  const isLarge = decided === 'large';

  // Weeks.
  const weeksUrl = route && decided ? `/api/availability?route=${route.id}` : null;
  const weeks = useJson<WeekRow[]>(weeksUrl, pickWeeks, weeksReload);
  useEffect(() => {
    if (weeks.status === 'ready' && form.weekStart) {
      const w = weeks.data.find((x) => x.start === form.weekStart);
      if (!w || w.closed || w.remaining < 1) set('weekStart', '');
    }
  }, [weeks, form.weekStart, set]);

  const payload = step1Payload(form);
  const lead = leadPayload(form);

  async function submitQuote() {
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
        return;
      }
      if (body.quoteRequired) {
        set('selectedClass', 'large');
        return;
      }
      setQuote(body as QuoteResponse);
      setStep('summary');
      track('quote_viewed', { route: body.route.id });
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

  const activeStep = step === 'form' ? 0 : 1;
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
      className="m-auto h-full max-h-none w-full max-w-none scroll-pt-32 overflow-y-auto bg-white p-0 sm:h-auto sm:max-h-[90vh] sm:w-[520px] sm:rounded-2xl"
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
                className={`h-1.5 rounded-full ${i <= activeStep ? 'bg-amber' : 'bg-black/10'}`}
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
            className="mb-5 rounded-lg border-2 border-amber bg-amber/10 p-4"
          >
            <p id="confirm-title" className="font-bold">
              {t.confirmClose.title}
            </p>
            <p id="confirm-body" className="mt-1 text-sm">
              {t.confirmClose.body}
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
          <SummaryStep quote={quote} onBack={() => setStep('form')} />
        )}

        {step === 'form' && (
          <form
            noValidate
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (isLarge) void submitLead();
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
                  inputMode="numeric"
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
                  inputMode="numeric"
                  autoComplete="off"
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
                <div>
                  <label htmlFor="year" className="block text-sm font-semibold text-muted">
                    {t.vehicle.year}
                  </label>
                  <select
                    id="year"
                    value={form.year}
                    onChange={(e) => set('year', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.vehicle.yearPlaceholder}</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {form.year && (
                  <Combobox
                    label={t.vehicle.make}
                    value={form.make}
                    onChange={(v) => set('make', v)}
                    options={makes.status === 'ready' ? makes.data : []}
                    placeholder={
                      makes.status === 'loading' ? t.vehicle.loading : t.vehicle.makePlaceholder
                    }
                    hint={makes.status === 'error' ? t.vehicle.lookupError : undefined}
                  />
                )}
                {form.year && form.make.trim() && (
                  <Combobox
                    label={t.vehicle.model}
                    value={form.model}
                    onChange={(v) => set('model', v)}
                    options={models.status === 'ready' ? models.data : []}
                    placeholder={
                      models.status === 'loading' ? t.vehicle.loading : t.vehicle.modelPlaceholder
                    }
                    hint={models.status === 'error' ? t.vehicle.lookupError : undefined}
                  />
                )}

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
                          <span className="block h-full rounded-lg border-2 border-black/15 px-3 py-2 peer-checked:border-navy peer-checked:bg-navy/5 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-amber">
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

            {routeOk && decided && (
              <section className="space-y-5">
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

                {!isLarge && (
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
                          extra: (
                            <ul className="mt-2 list-disc space-y-1 pl-9 pr-2 text-sm text-muted">
                              {topDeck.benefits.map((b) => (
                                <li key={b}>{b}</li>
                              ))}
                            </ul>
                          ),
                        },
                      ]}
                    />
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
                          className="mt-3 rounded-lg bg-amber/20 px-4 py-3 text-sm font-semibold"
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

                {isLarge && (
                  <section
                    aria-labelledby="lead-h"
                    className="space-y-4 rounded-lg border-2 border-navy/20 p-4"
                  >
                    <h3 id="lead-h" className="font-display text-xl font-extrabold uppercase">
                      {t.lead.heading}
                    </h3>
                    <p className="text-sm text-muted">{t.lead.intro}</p>
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
                  disabled={busy || (isLarge ? !lead : !payload)}
                >
                  {isLarge
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
