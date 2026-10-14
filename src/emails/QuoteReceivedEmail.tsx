import { Link } from '@react-email/components';
import { company, contactMailto } from '@/config/company';
import { emailCopy } from '@/content/emails';
import type { buildQuoteReceivedData } from '@/lib/email-data';
import { Banner, Block, colors, EmailLayout, Field, Heading, Paragraph } from './EmailLayout';

export function QuoteReceivedEmail({ d }: { d: ReturnType<typeof buildQuoteReceivedData> }) {
  const c = emailCopy.quoteReceived;
  return (
    <EmailLayout preview={c.preview}>
      <Heading>{c.heading}</Heading>
      <Paragraph>{c.intro}</Paragraph>

      <Block title={c.detailsHeading}>
        <Field label="Request">{d.ref}</Field>
        <Field label="Vehicle">{d.vehicle}</Field>
        <Field label="Route">{d.routeName}</Field>
        <Field label="Pickup">{d.pickup}</Field>
        <Field label="Delivery">{d.delivery}</Field>
        <Field label="Preferred pickup week">{d.preferredWeek}</Field>
      </Block>
      <Banner tone="info">
        <Paragraph>
          <strong>{c.reply}</strong> {c.noCharge}
        </Paragraph>
      </Banner>

      <Paragraph>
        {c.questions}{' '}
        <Link href={contactMailto} style={{ color: colors.navy, fontWeight: 700 }}>
          {company.contactEmail}
        </Link>
      </Paragraph>
    </EmailLayout>
  );
}
