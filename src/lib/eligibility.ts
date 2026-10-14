// Which vehicles can be booked online. Pure and shared by the browser (to switch the form) and the server
// (which re-decides on every /api/quote, /api/checkout and /api/leads request and never trusts the browser).
import {
  exoticMakes,
  exoticModelContains,
  quoteReasonIds,
  type QuoteReason,
} from '@/config/eligibility';
import { classifyVehicle, normalizeMake, type VehicleInput } from '@/lib/size-class';

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const exoticMakeKeys = exoticMakes.map(squash);
const exoticModelKeys = exoticModelContains.map(squash);

export type EligibilityInput = {
  vehicle: VehicleInput;
  /** The class the customer picked for a vehicle we could not match. Only "large" matters here. */
  selectedClass?: string | null;
  operable: boolean;
  modified: boolean;
  highValue: boolean;
};

export function isExotic({ make, model }: { make: string; model: string }): boolean {
  const mk = normalizeMake(make); // short names count: "rolls", "rr", "aston", "lambo"
  const md = squash(model);
  return (
    (mk !== '' && exoticMakeKeys.some((k) => mk === k || mk.startsWith(k))) ||
    (md !== '' && exoticModelKeys.some((k) => md.includes(k))) ||
    (mk !== '' && exoticModelKeys.some((k) => mk.includes(k)))
  );
}

/** Every reason this vehicle needs a personalized quote, in a fixed order. Empty means it can be booked online. */
export function quoteReasons(input: EligibilityInput): QuoteReason[] {
  const found = new Set<QuoteReason>();
  const classified = classifyVehicle(input.vehicle);
  if (classified === 'large' || (!classified && input.selectedClass === 'large'))
    found.add('large_vehicle');
  if (!input.operable) found.add('inoperable');
  if (input.modified) found.add('modified');
  if (isExotic(input.vehicle)) found.add('exotic');
  if (input.highValue) found.add('high_value');
  return quoteReasonIds.filter((r) => found.has(r));
}
