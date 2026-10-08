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
  weeklyCapacity: integer('weekly_capacity').notNull().default(12),
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
    closed: boolean('closed').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.weekStart] })],
);

export type Vehicle = { year: number; make: string; model: string };
export type Customer = { firstName: string; lastName: string; phone: string; email: string };
export type Address = {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
};

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
  },
  (t) => [
    index('bookings_route_week_status_idx').on(t.routeId, t.weekStart, t.status),
    index('bookings_status_hold_expires_idx').on(t.status, t.holdExpiresAt),
  ],
);

/** Quote-required requests (large vehicles). No deposit and no spot hold. */
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: createdAt(),
  routeId: integer('route_id')
    .notNull()
    .references(() => routes.id),
  pickupZip: text('pickup_zip').notNull(),
  deliveryZip: text('delivery_zip').notNull(),
  vehicle: jsonb('vehicle').$type<Vehicle>().notNull(),
  operable: boolean('operable').notNull(),
  modified: boolean('modified').notNull(),
  topDeck: boolean('top_deck').notNull().default(false),
  /** Optional preference only: a lead never holds a spot. */
  preferredWeekStart: date('preferred_week_start', { mode: 'string' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  notes: text('notes'),
  status: leadStatusEnum('status').notNull().default('new'),
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
