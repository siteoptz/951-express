// Renders the three emails with sample data to HTML files you can open in a browser.
// Usage: npx tsx scripts/preview-emails.tsx [outDir]   (default: .email-preview)
import { mkdirSync, writeFileSync } from 'node:fs';
import { render } from '@react-email/render';
import { CustomerConfirmationEmail } from '../src/emails/CustomerConfirmationEmail';
import { NewBookingEmail } from '../src/emails/NewBookingEmail';
import { NewLeadEmail } from '../src/emails/NewLeadEmail';
import {
  buildBookingEmailData,
  buildLeadEmailData,
  customerSubject,
  leadSubject,
  teamSubject,
  type BookingForEmail,
} from '../src/lib/email-data';

const out = process.argv[2] ?? '.email-preview';
mkdirSync(out, { recursive: true });

const home = { street: '1 Main St', city: 'Corona', state: 'CA', zip: '92881' };
const booking: BookingForEmail = {
  id: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b',
  vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
  customer: {
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: home,
  },
  pickupAddress: { street: '77 Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90001' },
  deliveryAddress: {
    street: '9 Pier Rd',
    street2: 'Unit 2',
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
  },
  pickupZip: '90001',
  deliveryZip: '21201',
  weekStart: '2026-10-19',
  sizeClass: 'small-suv',
  sizeClassSource: 'table',
  operable: true,
  modified: false,
  topDeck: true,
  personalItems: true,
  totalCents: 165000,
  depositCents: 10000,
  balanceCents: 155000,
  needsReview: false,
  termsVersion: '0.0-placeholder',
  termsAcceptedAt: new Date('2026-10-10T20:05:00Z'),
  paidAt: new Date('2026-10-10T20:09:30Z'),
  stripePaymentIntent: 'pi_3Qexample',
  notes: 'Gate code 1234. Please call before arriving.',
};
const ctx = {
  routeName: 'West → East',
  sizeClassLabel: 'Small SUV',
  spot: { n: 3, of: 12 },
  stripeTestMode: true,
};

const files: [string, string, React.ReactElement][] = [];
const d = buildBookingEmailData(booking, ctx);
files.push(['1-new-booking', teamSubject(d), <NewBookingEmail key="a" d={d} />]);
const flagged = buildBookingEmailData(
  {
    ...booking,
    sizeClassSource: 'customer',
    needsReview: true,
    pickupAddress: { ...booking.pickupAddress, zip: '90210' },
  },
  ctx,
);
files.push([
  '1b-new-booking-review-needed',
  teamSubject(flagged),
  <NewBookingEmail key="b" d={flagged} />,
]);
files.push([
  '2-customer-confirmation',
  customerSubject(d),
  <CustomerConfirmationEmail key="c" d={d} />,
]);
const lead = buildLeadEmailData(
  {
    id: booking.id,
    createdAt: new Date('2026-10-10T20:05:00Z'),
    name: 'Lee Large',
    phone: '555-010-0199',
    email: 'lee@example.com',
    vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
    pickupZip: '90001',
    deliveryZip: '21201',
    operable: true,
    modified: true,
    highValue: false,
    quoteReasons: ['large_vehicle', 'modified'],
    modificationDetails: '5-inch lift, 35-inch tires, roof rack',
    topDeck: false,
    preferredWeekStart: '2026-10-26',
    notes: null,
  },
  'West → East',
);
files.push(['3-new-lead', leadSubject(lead), <NewLeadEmail key="d" d={lead} />]);

async function main() {
  for (const [name, subject, el] of files) {
    const html = (await render(el)).replace(
      '<head>',
      `<head><title>${subject.replace(/</g, '&lt;')}</title>`,
    );
    writeFileSync(`${out}/${name}.html`, html);
    console.log(`${name}.html  |  ${subject}`);
  }
}

void main();
