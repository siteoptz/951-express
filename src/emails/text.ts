// Plain-text versions of the emails (the part email clients show when they do not render HTML).
import { booking } from '@/config/booking';
import { company } from '@/config/company';
import { emailCopy } from '@/content/emails';
import type { BookingEmailData, buildLeadEmailData } from '@/lib/email-data';
import { deliveryWindowText } from '@/lib/delivery-window';
import { money } from '@/lib/format';

const line = (label: string, value: string) => `${label}: ${value}`;
const section = (title: string, rows: string[]) => `${title.toUpperCase()}\n${rows.join('\n')}`;
const yn = (v: boolean) => (v ? 'Yes' : 'No');
const footer = `${company.name} · USDOT ${company.usdot} · ${company.mc}\n${company.insurance}\n${company.contactEmail}`;

export function teamText(d: BookingEmailData): string {
  const parts: string[] = [];
  if (d.needsReview)
    parts.push(`${emailCopy.team.reviewBanner.toUpperCase()}\n${d.reviewReasons.join('\n')}`);
  parts.push(`${d.vehicle}\n${d.routeName} · Week of ${d.week} · Booking ${d.ref}`);
  parts.push(
    section('Customer', [
      line('Name', d.customer.name),
      line('Phone', d.customer.phone),
      line('Email', d.customer.email),
      ...(d.customer.address ? [line('Home address', d.customer.address)] : []),
    ]),
  );
  if (d.addressFlags.length > 0)
    parts.push(
      section(
        'Address review',
        d.addressFlags.map((f) => `- ${f}`),
      ),
    );
  parts.push(
    section('Shipment', [
      line(
        'Pickup',
        d.pickup.address +
          (d.pickup.changedFrom ? ` (quoted for ZIP ${d.pickup.changedFrom})` : ''),
      ),
      line(
        'Delivery',
        d.delivery.address +
          (d.delivery.changedFrom ? ` (quoted for ZIP ${d.delivery.changedFrom})` : ''),
      ),
      line('Route and direction', d.routeName),
      line('Pickup week', `${d.week} (${d.spotText})`),
      line('Vehicle', d.vehicle),
      ...(d.vehicleTyped ? [line('As typed by the customer', d.vehicleTyped)] : []),
      line('Size class', `${d.sizeClass} (${d.sizeSource})`),
      line('Operable', yn(d.operable)),
      line('Modified', yn(d.modified)),
      line('Load type', d.topDeck ? 'TOP DECK LOAD' : d.loadType),
      line('Personal items', d.personalItems ? 'Yes (100 lbs included)' : 'No'),
      ...(d.notes ? [line('Notes for the driver', d.notes)] : []),
    ]),
  );
  parts.push(
    section('Payment', [
      line('Transport total', money(d.totalCents)),
      line('Deposit paid', money(d.depositCents)),
      line('Balance due at delivery', money(d.balanceCents)),
      line('Balance payment', `${booking.balanceMethods.join(', ')} only. No credit cards.`),
      ...(d.paidAt ? [line('Paid', d.paidAt)] : []),
      line('Terms accepted', `Version ${d.termsVersion}, ${d.termsAcceptedAt}`),
      ...(d.stripeUrl ? [line('Stripe', d.stripeUrl)] : []),
    ]),
  );
  parts.push('Times are Pacific.', footer);
  return parts.join('\n\n');
}

export function customerText(d: BookingEmailData): string {
  const c = emailCopy.customer;
  const parts = [
    `${c.heading}\n${c.intro}`,
    section('Your receipt', [
      line('Booking', d.ref),
      line('Vehicle', d.vehicle),
      line('Route', d.routeName),
      line('Pickup week', d.week),
      line('Pickup', d.pickup.address),
      line('Delivery', d.delivery.address),
      line('Load type', d.loadType),
      line('Transport total', money(d.totalCents)),
      line('Deposit paid', money(d.depositCents)),
      line('Balance due at delivery', money(d.balanceCents)),
      line('Estimated delivery', deliveryWindowText()),
    ]),
    booking.balanceMessage,
    section(
      c.nextStepsHeading,
      c.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    ),
    section(c.personalItemsHeading, [d.personalItemsNotice]),
    ...(d.topDeck
      ? [
          section(
            c.topDeckHeading,
            d.topDeckBenefits.map((b) => `- ${b}`),
          ),
        ]
      : []),
    `${c.questions} ${company.contactEmail}`,
    footer,
  ];
  return parts.join('\n\n');
}

export function leadText(d: ReturnType<typeof buildLeadEmailData>): string {
  return [
    `${emailCopy.lead.heading}\n${d.vehicle} · ${d.routeName} · Request ${d.ref}`,
    emailCopy.lead.note,
    section(emailCopy.lead.reasonsHeading, [
      line('Reasons', d.reasons.join(', ')),
      ...(d.modificationDetails
        ? [line(emailCopy.lead.modificationHeading, d.modificationDetails)]
        : []),
    ]),
    section('Contact', [line('Name', d.name), line('Phone', d.phone), line('Email', d.email)]),
    section('Shipment', [
      line('Vehicle', d.vehicle),
      ...(d.vehicleTyped ? [line('As typed by the customer', d.vehicleTyped)] : []),
      line('Route', d.routeName),
      line('Pickup ZIP', d.pickupZip),
      line('Delivery ZIP', d.deliveryZip),
      line('Operable', yn(d.operable)),
      line('Modified', yn(d.modified)),
      line('Worth over $100,000', yn(d.highValue)),
      ...(d.topDeck ? [line('Load type', 'Top Deck Load')] : []),
      line('Preferred pickup week', d.preferredWeek ?? 'No preference'),
      ...(d.notes ? [line('Notes', d.notes)] : []),
    ]),
    `Received ${d.receivedAt} (Pacific).`,
    footer,
  ].join('\n\n');
}
