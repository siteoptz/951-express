import { Link } from '@react-email/components';
import { emailCopy } from '@/content/emails';
import type { buildLeadEmailData } from '@/lib/email-data';
import { Banner, Block, colors, EmailLayout, Field, Heading, Paragraph } from './EmailLayout';

const yn = (v: boolean) => (v ? 'Yes' : 'No');

export function NewLeadEmail({ d }: { d: ReturnType<typeof buildLeadEmailData> }) {
  const c = emailCopy.lead;
  return (
    <EmailLayout preview={c.preview}>
      <Heading>{c.heading}</Heading>
      <Paragraph muted>
        {d.vehicle} · {d.routeName} · Request {d.ref}
      </Paragraph>
      <Banner tone="info">
        <Paragraph>{c.note}</Paragraph>
      </Banner>

      <Block title={c.reasonsHeading}>
        <Field label="Reasons">{d.reasons.join(', ')}</Field>
        {d.modificationDetails && (
          <Field label={c.modificationHeading}>{d.modificationDetails}</Field>
        )}
      </Block>

      <Block title="Contact">
        <Field label="Name">{d.name}</Field>
        <Field label="Phone">{d.phone}</Field>
        <Field label="Email">
          <Link href={`mailto:${d.email}`} style={{ color: colors.navy }}>
            {d.email}
          </Link>
        </Field>
      </Block>

      <Block title="Shipment">
        <Field label="Vehicle">{d.vehicle}</Field>
        {d.vehicleTyped && <Field label="As typed by the customer">{d.vehicleTyped}</Field>}
        <Field label="Route">{d.routeName}</Field>
        <Field label="Pickup ZIP">{d.pickupZip}</Field>
        <Field label="Delivery ZIP">{d.deliveryZip}</Field>
        <Field label="Operable">{yn(d.operable)}</Field>
        <Field label="Modified">{yn(d.modified)}</Field>
        <Field label="Worth over $100,000">{yn(d.highValue)}</Field>
        {d.topDeck && <Field label="Load type">Top Deck Load</Field>}
        <Field label="Preferred pickup week">{d.preferredWeek ?? 'No preference'}</Field>
        {d.notes && <Field label="Notes">{d.notes}</Field>}
      </Block>
      <Paragraph muted>Received {d.receivedAt} (Pacific).</Paragraph>
    </EmailLayout>
  );
}
