import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { company, contactMailto } from '@/config/company';
import { siteUrl } from '@/config/site';

const navy = '#0E1A2B';
const accent = '#F06A1A';
const muted = '#55627A';
const line = '#E3E7EE';
const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: '24px 0',
          backgroundColor: '#F3F5F8',
          fontFamily: font,
          color: navy,
        }}
      >
        <Container
          style={{
            maxWidth: 600,
            margin: '0 auto',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Section style={{ backgroundColor: navy, padding: '16px 28px' }}>
            {/* An absolute URL on our own site: email clients cannot load a relative path. */}
            <Img
              src={`${siteUrl()}${company.logo.email.path}`}
              alt={company.logo.alt}
              width={company.logo.email.width}
              height={company.logo.email.height}
              style={{ display: 'block', border: 0 }}
            />
          </Section>
          <Section style={{ padding: '24px 28px 8px' }}>{children}</Section>
          <Hr style={{ borderColor: line, margin: '16px 28px 0' }} />
          <Section style={{ padding: '16px 28px 24px' }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: muted }}>
              {company.name} · USDOT {company.usdot} · {company.mc}
              <br />
              {company.insurance}
              <br />
              {company.address.city}, {company.address.state} ·{' '}
              <Link href={contactMailto} style={{ color: muted }}>
                {company.contactEmail}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{ margin: '0 0 6px', fontSize: 26, lineHeight: '30px', fontWeight: 800, color: navy }}
    >
      {children}
    </Text>
  );
}

export function Paragraph({ children, muted: isMuted }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      style={{
        margin: '0 0 14px',
        fontSize: 15,
        lineHeight: '22px',
        color: isMuted ? muted : navy,
      }}
    >
      {children}
    </Text>
  );
}

/** A titled group of label/value rows. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section style={{ margin: '18px 0 0' }}>
      <Text
        style={{
          margin: '0 0 6px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: muted,
        }}
      >
        {title}
      </Text>
      <Hr style={{ borderColor: navy, borderWidth: 2, margin: '0 0 4px' }} />
      {children}
    </Section>
  );
}

export function Field({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <Row style={{ borderBottom: `1px solid ${line}` }}>
      <Column
        style={{
          width: '38%',
          padding: '8px 8px 8px 0',
          verticalAlign: 'top',
          fontSize: 13,
          color: muted,
        }}
      >
        {label}
      </Column>
      <Column
        style={{
          padding: '8px 0',
          verticalAlign: 'top',
          fontSize: 14,
          fontWeight: strong ? 800 : 600,
          color: navy,
        }}
      >
        {children}
      </Column>
    </Row>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: 'warn' | 'good' | 'info';
  children: ReactNode;
}) {
  const colors = {
    warn: ['#FDECEC', '#C8343B'],
    good: ['#E6F4EC', '#17803F'],
    info: ['#FDE8D9', '#F06A1A'],
  }[tone];
  return (
    <Section
      style={{
        margin: '0 0 16px',
        padding: '12px 14px',
        backgroundColor: colors[0],
        borderLeft: `4px solid ${colors[1]}`,
        borderRadius: 6,
      }}
    >
      {children}
    </Section>
  );
}

export const colors = { navy, accent, muted, line, danger: '#C8343B', success: '#17803F' };
