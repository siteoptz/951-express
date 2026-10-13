import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const regionEnum = pgEnum('region', ['west', 'east']);
export const bookingStatusEnum = pgEnum('booking_status', [
  'held',
  'paid',
  'completed',
  'cancelled',
  'expired',
]);
export const sizeClassSourceEnum = pgEnum('size_class_source', ['table', 'customer']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'closed']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** `id` is the integer half of the advisory lock key; `slug` is the stable name used in code (routes.ts). */
export const routes = pgTable('routes', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  pickupRegion: regionEnum('pickup_region').notNull(),
  deliveryRegion: regionEnum('delivery_region').notNull(),
  weeklyCapacity: integer('weekly_capacity').notNull().default(6),
  active: boolean('active').notNull().default(true),
});

export const weekOverrides = pgTable(
  'week_overrides',
  {
    routeId: integer('route_id')
      .notNull()
      .references(() => routes.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    capacityOverride: integer('capacity_override'),
    /** Per-week top-deck slot overrides (null = the config default). Phase 8 sets these in the weeks grid. */
    topDeckSuvOverride: integer('top_deck_suv_override'),
    topDeckCarOverride: integer('top_deck_car_override'),
    closed: boolean('closed').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.weekStart] })],
);

export type Vehicle = { year: number; make: string; model: string };
/** The vehicle exactly as the customer typed it (the year as text), kept next to the normalized `vehicle`. */
export type VehicleTyped = { year: string; make: string; model: string };
export type Address = {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
};
/** The customer's own details from Step 3; `address` is their home address. */
export type Customer = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: Address;
};

/** A person to meet at pickup or delivery. */
export type Contact = { name: string; phone: string };

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicToken: text('public_token').notNull().unique(),
    status: bookingStatusEnum('status').notNull().default('held'),
    routeId: integer('route_id')
      .notNull()
      .references(() => routes.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    pickupZip: text('pickup_zip').notNull(),
    deliveryZip: text('delivery_zip').notNull(),
    pickupRegion: regionEnum('pickup_region').notNull(),
    deliveryRegion: regionEnum('delivery_region').notNull(),
    vehicle: jsonb('vehicle').$type<Vehicle>().notNull(),
    /** What the customer typed, exactly (null on bookings made before typed entry). */
    vehicleTyped: jsonb('vehicle_typed').$type<VehicleTyped>(),
    operable: boolean('operable').notNull(),
    modified: boolean('modified').notNull(),
    topDeck: boolean('top_deck').notNull().default(false),
    personalItems: boolean('personal_items').notNull(),
    sizeClass: text('size_class').notNull(),
    sizeClassSource: sizeClassSourceEnum('size_class_source').notNull(),
    totalCents: integer('total_cents').notNull(),
    depositCents: integer('deposit_cents').notNull(),
    balanceCents: integer('balance_cents').notNull(),
    needsReview: boolean('needs_review').notNull().default(false),
    /** Why it needs review, e.g. "vehicle not recognized: 'zzz thing'" (null when there is no specific reason). */
    reviewReason: text('review_reason'),
    /** Address problems the customer confirmed anyway, in words the team can act on (empty when there are none). */
    addressFlags: jsonb('address_flags').$type<string[]>(),
    // Optional Step 3 details for the dispatch sheet. A missing contact means the customer.
    vehicleColor: text('vehicle_color'),
    vehicleVin: text('vehicle_vin'),
    pickupContact: jsonb('pickup_contact').$type<Contact>(),
    deliveryContact: jsonb('delivery_contact').$type<Contact>(),
    termsVersion: text('terms_version').notNull(),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
    stripeSessionId: text('stripe_session_id').unique(),
    stripePaymentIntent: text('stripe_payment_intent'),
    payerEmail: text('payer_email'),
    holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
    customer: jsonb('customer').$type<Customer>(),
    pickupAddress: jsonb('pickup_address').$type<Address>(),
    deliveryAddress: jsonb('delivery_address').$type<Address>(),
    notes: text('notes'),
    createdAt: createdAt(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    detailsSubmittedAt: timestamp('details_submitted_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    // Email bookkeeping. A failed email never fails the booking: the error is kept here instead.
    teamEmailSentAt: timestamp('team_email_sent_at', { withTimezone: true }),
    customerEmailSentAt: timestamp('customer_email_sent_at', { withTimezone: true }),
    emailError: text('email_error'),
  },
  (t) => [
    index('bookings_route_week_status_idx').on(t.routeId, t.weekStart, t.status),
    index('bookings_status_hold_expires_idx').on(t.status, t.holdExpiresAt),
  ],
);

/** Quote-required requests (large, inoperable, modified, exotic or high-value vehicles). No deposit and no spot hold. */
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: createdAt(),
  routeId: integer('route_id')
    .notNull()
    .references(() => routes.id),
  pickupZip: text('pickup_zip').notNull(),
  deliveryZip: text('delivery_zip').notNull(),
  vehicle: jsonb('vehicle').$type<Vehicle>().notNull(),
  vehicleTyped: jsonb('vehicle_typed').$type<VehicleTyped>(),
  operable: boolean('operable').notNull(),
  modified: boolean('modified').notNull(),
  topDeck: boolean('top_deck').notNull().default(false),
  /** Why this vehicle needs a personalized quote: large_vehicle, inoperable, modified, exotic, high_value. */
  quoteReasons: jsonb('quote_reasons').$type<string[]>().notNull().default([]),
  /** What was changed, required when the vehicle is modified. */
  modificationDetails: text('modification_details'),
  /** The customer's answer to "worth more than $100,000?". */
  highValue: boolean('high_value').notNull().default(false),
  /** Optional preference only: a lead never holds a spot. */
  preferredWeekStart: date('preferred_week_start', { mode: 'string' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  notes: text('notes'),
  status: leadStatusEnum('status').notNull().default('new'),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  emailError: text('email_error'),
});

/** Base price per size class. Seeded from src/config/pricing.ts; the admin edits these in Phase 8. */
export const rates = pgTable('rates', {
  sizeClass: text('size_class').primaryKey(),
  label: text('label').notNull(),
  example: text('example').notNull(),
  baseCents: integer('base_cents').notNull(),
  sortOrder: integer('sort_order').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Key/value business settings (surcharges, deposit). Values are JSON so one table holds every type. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
