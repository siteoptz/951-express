import { Link, Text } from '@react-email/components';
import { booking } from '@/config/booking';
import { emailCopy } from '@/content/emails';
import { money } from '@/lib/format';
import type { BookingEmailData } from '@/lib/email-data';
import { Banner, Block, colors, EmailLayout, Field, Heading, Paragraph } from './EmailLayout';

const yn = (v: boolean) => (v ? 'Yes' : 'No');

export function NewBookingEmail({ d }: { d: BookingEmailData }) {
  return (
    <EmailLayout preview={emailCopy.team.preview}>
      {d.needsReview && (
        <Banner tone="warn">
          <Text style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: colors.danger }}>
            {emailCopy.team.reviewBanner}
          </Text>
          {d.reviewReasons.map((r) => (
            <Text key={r} style={{ margin: '0 0 4px', fontSize: 14, lineHeight: '20px' }}>
              {r}
            </Text>
          ))}
        </Banner>
      )}
      <Heading>{d.vehicle}</Heading>
      <Paragraph muted>
        {d.routeName} · Week of {d.week} · Booking {d.ref}
      </Paragraph>

      <Block title="Customer">
        <Field label="Name">{d.customer.name}</Field>
        <Field label="Phone">{d.customer.phone}</Field>
        <Field label="Email">
          <Link href={`mailto:${d.customer.email}`} style={{ color: colors.navy }}>
            {d.customer.email}
          </Link>
        </Field>
        {d.customer.address && <Field label="Home address">{d.customer.address}</Field>}
      </Block>

      {d.addressFlags.length > 0 && (
        <Block title="Address review">
          {d.addressFlags.map((flag) => (
            <Text key={flag} style={{ margin: '8px 0 0', fontSize: 14, lineHeight: '21px' }}>
              • {flag}
            </Text>
          ))}
        </Block>
      )}

      <Block title="Shipment">
        <Field label="Pickup">
          {d.pickup.address}
          {d.pickup.changedFrom && (
            <span style={{ color: colors.muted, fontWeight: 400 }}>
              {' '}
              (quoted for ZIP {d.pickup.changedFrom})
            </span>
          )}
        </Field>
        <Field label="Delivery">
          {d.delivery.address}
          {d.delivery.changedFrom && (
            <span style={{ color: colors.muted, fontWeight: 400 }}>
              {' '}
              (quoted for ZIP {d.delivery.changedFrom})
            </span>
          )}
        </Field>
        <Field label="Route and direction">{d.routeName}</Field>
        <Field label="Pickup week">
          {d.week} ({d.spotText})
        </Field>
        <Field label="Vehicle">{d.vehicle}</Field>
        {d.vehicleTyped && <Field label="As typed by the customer">{d.vehicleTyped}</Field>}
        <Field label="Size class">
          {d.sizeClass}{' '}
          <span style={{ color: colors.muted, fontWeight: 400 }}>({d.sizeSource})</span>
        </Field>
        <Field label="Operable">{yn(d.operable)}</Field>
        <Field label="Modified">{yn(d.modified)}</Field>
        <Field label="Load type">
          {d.topDeck ? (
            <span
              style={{
                backgroundColor: '#FDE8D9',
                color: '#9A3412',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 800,
              }}
            >
              TOP DECK LOAD
            </span>
          ) : (
            d.loadType
          )}
        </Field>
        <Field label="Personal items">{d.personalItems ? booking.personalItemsYes : 'No'}</Field>
        {d.notes && <Field label="Notes for the driver">{d.notes}</Field>}
      </Block>

      <Block title="Payment">
        <Field label="Transport total">{money(d.totalCents)}</Field>
        <Field label="Deposit paid" strong>
          {money(d.depositCents)}
        </Field>
        <Field label="Balance due at delivery" strong>
          {money(d.balanceCents)}
        </Field>
        <Field label="Balance payment">
          {booking.balanceMethods.join(', ')} only. No credit cards.
        </Field>
        {d.paidAt && <Field label="Paid">{d.paidAt}</Field>}
        <Field label="Terms accepted">
          Version {d.termsVersion}, {d.termsAcceptedAt}
        </Field>
        {d.stripeUrl && (
          <Field label="Stripe">
            <Link href={d.stripeUrl} style={{ color: colors.navy }}>
              View payment
            </Link>
          </Field>
        )}
      </Block>
      <Paragraph muted>Times are Pacific.</Paragraph>
    </EmailLayout>
  );
}
