// Pure state for the booking modal form: reducer, persistence, and the payload sent to the server.
import { sizeClassIds } from '@/config/pricing';
import { vehicleYears } from '@/config/vehicles';
import { classifyVehicle } from '@/lib/size-class';
import type { VehicleClass } from '@/config/vehicle-classes';

export type FormState = {
  pickupZip: string;
  deliveryZip: string;
  year: string;
  make: string;
  model: string;
  selectedClass: string;
  operable: boolean | null;
  modified: boolean | null;
  topDeck: boolean;
  personalItems: boolean | null;
  weekStart: string;
  leadWeek: string;
  terms: boolean;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export const initialForm: FormState = {
  pickupZip: '',
  deliveryZip: '',
  year: '',
  make: '',
  model: '',
  selectedClass: '',
  operable: null,
  modified: null,
  topDeck: false,
  personalItems: null,
  weekStart: '',
  leadWeek: '',
  terms: false,
  name: '',
  phone: '',
  email: '',
  notes: '',
};

export type FormAction =
  | { type: 'set'; field: keyof FormState; value: string | boolean | null }
  | { type: 'hydrate'; state: Partial<FormState> }
  | { type: 'reset' };

/** Changing a field clears the answers that depend on it. */
export function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === 'reset') return initialForm;
  if (action.type === 'hydrate') return { ...state, ...action.state };
  const next = { ...state, [action.field]: action.value } as FormState;
  if (action.field === 'year') return { ...next, make: '', model: '', selectedClass: '' };
  if (action.field === 'make') return { ...next, model: '', selectedClass: '' };
  if (action.field === 'model') return { ...next, selectedClass: '' };
  if (action.field === 'pickupZip')
    return { ...next, deliveryZip: '', weekStart: '', leadWeek: '' };
  if (action.field === 'deliveryZip') return { ...next, weekStart: '' };
  return next;
}

export const isDirty = (f: FormState): boolean =>
  (Object.keys(initialForm) as (keyof FormState)[]).some((k) => f[k] !== initialForm[k]);

export const digitsOnly = (v: string): string => v.replace(/\D/g, '').slice(0, 5);

export const isZip = (v: string): boolean => /^\d{5}$/.test(v);

export function yearOptions(now: Date = new Date()): number[] {
  const out: number[] = [];
  for (let y = now.getFullYear() + vehicleYears.maxAheadOfToday; y >= vehicleYears.min; y--)
    out.push(y);
  return out;
}

/** The class we will price: the table's answer, else the customer's pick for an unknown vehicle. */
export function decidedClass(f: FormState): {
  classified: VehicleClass | null;
  decided: VehicleClass | null;
} {
  const year = Number(f.year);
  if (!f.year || !f.make.trim() || !f.model.trim()) return { classified: null, decided: null };
  const classified = classifyVehicle({ year, make: f.make, model: f.model });
  if (classified) return { classified, decided: classified };
  const picked = f.selectedClass;
  const ok = picked === 'large' || (sizeClassIds as readonly string[]).includes(picked);
  return { classified: null, decided: ok ? (picked as VehicleClass) : null };
}

/** Body for POST /api/quote, or null while anything is missing. Prices are never included. */
export function step1Payload(f: FormState) {
  const { decided } = decidedClass(f);
  if (!decided || decided === 'large') return null;
  if (f.operable === null || f.modified === null || f.personalItems === null) return null;
  if (!isZip(f.pickupZip) || !isZip(f.deliveryZip) || !f.weekStart || !f.terms) return null;
  return {
    pickupZip: f.pickupZip,
    deliveryZip: f.deliveryZip,
    vehicle: { year: Number(f.year), make: f.make.trim(), model: f.model.trim() },
    selectedClass: f.selectedClass || undefined,
    operable: f.operable,
    modified: f.modified,
    topDeck: f.topDeck,
    personalItems: f.personalItems,
    weekStart: f.weekStart,
    termsAccepted: true as const,
  };
}

/** Body for POST /api/leads (large vehicles), or null while anything is missing. */
export function leadPayload(f: FormState) {
  const { decided } = decidedClass(f);
  if (decided !== 'large') return null;
  if (f.operable === null || f.modified === null) return null;
  if (!isZip(f.pickupZip) || !isZip(f.deliveryZip)) return null;
  if (!f.name.trim() || !f.phone.trim() || !f.email.trim()) return null;
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    pickupZip: f.pickupZip,
    deliveryZip: f.deliveryZip,
    vehicle: { year: Number(f.year), make: f.make.trim(), model: f.model.trim() },
    selectedClass: f.selectedClass || undefined,
    operable: f.operable,
    modified: f.modified,
    preferredWeekStart: f.leadWeek || undefined,
    notes: f.notes.trim() || undefined,
  };
}

const KEY = 'booking-form-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Terms acceptance is never saved: the customer agrees each time. */
export function saveForm(f: FormState, storage: StorageLike | null): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...f, terms: false }));
  } catch {
    // Storage can be blocked or full; the form still works without it.
  }
}

export function loadForm(storage: StorageLike | null): Partial<FormState> {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(initialForm) as (keyof FormState)[]) {
      if (
        typeof data[key] === typeof initialForm[key] ||
        (initialForm[key] === null && (typeof data[key] === 'boolean' || data[key] === null))
      ) {
        out[key] = data[key];
      }
    }
    out.terms = false;
    return out as Partial<FormState>;
  } catch {
    return {};
  }
}

export function clearForm(storage: StorageLike | null): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
