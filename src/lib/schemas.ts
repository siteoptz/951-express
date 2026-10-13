import { z } from 'zod';
import { modificationDetailsMaxLength } from '@/config/eligibility';
import { sizeClassIds } from '@/config/pricing';
import { routeIds } from '@/config/routes';
import { isValidYear } from '@/lib/vehicle-normalize';
import { isMondayIso } from '@/lib/weeks';

const zip = z.string().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code');
const phone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (v) => v.replace(/\D/g, '').length >= 10 && /^[\d\s()+.-]+$/.test(v),
    'Enter a valid phone number',
  );
const name = z.string().trim().min(1).max(80);
const notes = z.string().trim().max(2000);
const modificationDetails = z.string().trim().max(modificationDetailsMaxLength);

const noControlChars = (v: string) => !/[\u0000-\u001f\u007f]/.test(v);
const typedText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => v.trim().length > 0, 'Required')
    .refine(noControlChars, 'Use letters and numbers only');

/**
 * The vehicle exactly as the customer typed it (the browser never trims or fixes it). The server normalizes it
 * (src/lib/vehicle-normalize.ts), stores both, and classifies from the normalized values.
 */
export const vehicleSchema = z.object({
  year: z
    .number()
    .int()
    .refine((y) => isValidYear(y), 'Enter a year from 1950 to next year'),
  make: typedText(60),
  model: typedText(80),
});

/** Class the customer may pick when the vehicle is unknown. The server re-classifies and may ignore it. */
export const selectableClass = z.enum([...sizeClassIds, 'large']);

/** A Monday, as YYYY-MM-DD. Whether it is currently bookable is checked on the server (findBookableWeek). */
export const weekStartSchema = z.string().refine(isMondayIso, 'Pick a pickup week');

/** Step 1 (Qualify & Quote). The server recomputes route, class, price, and availability from this. */
export const step1Schema = z.object({
  pickupZip: zip,
  deliveryZip: zip,
  vehicle: vehicleSchema,
  selectedClass: selectableClass.optional(),
  operable: z.boolean(),
  modified: z.boolean(),
  /** "Is your vehicle worth more than $100,000?" Required: Yes sends the customer to the quote form. */
  highValue: z.boolean(),
  modificationDetails: modificationDetails.optional(),
  topDeck: z.boolean().default(false),
  personalItems: z.boolean(),
  weekStart: weekStartSchema,
  termsAccepted: z.literal(true, { error: 'You must accept the Terms and Conditions' }),
});
export type Step1 = z.infer<typeof step1Schema>;

/**
 * "Request a personalized quote" form: vehicles that cannot be booked online (large, inoperable, modified, exotic,
 * high value). No deposit and no spot hold. The server decides the reasons; it never trusts the browser.
 */
export const quoteRequestSchema = z
  .object({
    name: name.max(120),
    phone,
    email: z.email().max(200),
    pickupZip: zip,
    deliveryZip: zip,
    vehicle: vehicleSchema,
    operable: z.boolean(),
    modified: z.boolean(),
    highValue: z.boolean(),
    /** Required when modified is Yes: what was changed. */
    modificationDetails: modificationDetails.optional(),
    topDeck: z.boolean().default(false),
    /** Only used when the vehicle is unknown and the customer picked "large". The server re-classifies. */
    selectedClass: selectableClass.optional(),
    /** Optional: a Monday the customer would like. Preference only, no spot is held. */
    preferredWeekStart: weekStartSchema.optional(),
    notes: notes.optional(),
  })
  .refine((d) => !d.modified || !!d.modificationDetails, {
    path: ['modificationDetails'],
    message: 'Describe the modifications',
  });
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const addressSchema = z.object({
  street: z.string().trim().min(1).max(120),
  street2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().length(2).toUpperCase(),
  zip,
});

/** Step 3 (customer details, after payment). Pickup and delivery ZIPs are locked to the qualified ZIPs on the server. */
export const step3Schema = z.object({
  firstName: name,
  lastName: name,
  phone,
  email: z.email().max(200),
  address: addressSchema,
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  notes: notes.optional(),
});
export type Step3 = z.infer<typeof step3Schema>;

const routeId = z.enum(routeIds);
const cents = z.number().int().min(0).max(10_000_000);

/** Admin actions (Phase 8). Every action is logged with who, what, and when. */
export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('close_week'), routeId, weekStart: weekStartSchema }),
  z.object({ action: z.literal('reopen_week'), routeId, weekStart: weekStartSchema }),
  z.object({
    action: z.literal('set_capacity'),
    routeId,
    weekStart: weekStartSchema,
    capacity: z.number().int().min(0).max(100).nullable(),
  }),
  z.object({ action: z.literal('cancel_booking'), bookingId: z.uuid() }),
  z.object({
    action: z.literal('update_rates'),
    baseCents: z.partialRecord(z.enum(sizeClassIds), cents).optional(),
    topDeckSurchargeCents: cents.optional(),
    depositPercent: z.number().min(1).max(100).optional(),
  }),
]);
export type AdminAction = z.infer<typeof adminActionSchema>;
