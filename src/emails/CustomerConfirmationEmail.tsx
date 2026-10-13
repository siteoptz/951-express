import { Link, Text } from '@react-email/components';
import { booking } from '@/config/booking';
import { company, contactMailto } from '@/config/company';
import { emailCopy } from '@/content/emails';
import { deliveryWindowText } from '@/lib/delivery-window';
import { money } from '@/lib/format';
import type { BookingEmailData } from '@/lib/email-data';
import { Banner, Block, colors, EmailLayout, Field, Heading, Paragraph } from './EmailLayout';

export function CustomerConfirmationEmail({ d }: { d: BookingEmailData }) {
  const c = emailCopy.customer;
  return (
    <EmailLayout preview={c.preview}>
      <Heading>{c.heading}</Heading>
      <Paragraph>{c.intro}</Paragraph>

      <Block title="Your receipt">
        <Field label="Booking">{d.ref}</Field>
        <Field label="Vehicle">{d.vehicle}</Field>
        <Field label="Route">{d.routeName}</Field>
        <Field label="Pickup week">{d.week}</Field>
        <Field label="Pickup">{d.pickup.address}</Field>
        <Field label="Delivery">{d.delivery.address}</Field>
        <Field label="Load type">{d.loadType}</Field>
        <Field label="Transport total">{money(d.totalCents)}</Field>
        <Field label="Deposit paid" strong>
          {money(d.depositCents)}
        </Field>
        <Field label="Balance due at delivery" strong>
          {money(d.balanceCents)}
        </Field>
        <Field label="Estimated delivery">{deliveryWindowText()}</Field>
      </Block>
      <Banner tone="info">
        <Paragraph>
          <strong>{booking.balanceMessage}</strong>
        </Paragraph>
      </Banner>

      <Block title={c.nextStepsHeading}>
        {c.nextSteps.map((step, i) => (
          <Text key={step} style={{ margin: '8px 0 0', fontSize: 14, lineHeight: '21px' }}>
            {i + 1}. {step}
          </Text>
        ))}
      </Block>

      <Block title={c.personalItemsHeading}>
        <Text style={{ margin: '8px 0 0', fontSize: 14, lineHeight: '21px' }}>
          {d.personalItemsNotice}
        </Text>
      </Block>

      {d.topDeck && (
        <Block title={c.topDeckHeading}>
          <Banner tone="info">
            {d.topDeckBenefits.map((b) => (
              <Text key={b} style={{ margin: '0 0 4px', fontSize: 14, lineHeight: '20px' }}>
                • {b}
              </Text>
            ))}
          </Banner>
        </Block>
      )}

      <Paragraph>
        {c.questions}{' '}
        <Link href={contactMailto} style={{ color: colors.navy, fontWeight: 700 }}>
          {company.contactEmail}
        </Link>
      </Paragraph>
    </EmailLayout>
  );
}
