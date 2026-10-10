import { company, contactMailto } from '@/config/company';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function ContactSection() {
  const c = landing.contact;
  return (
    <Section id="contact" tone="navy">
      <SectionHeading title={c.heading} intro={c.body} light />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <QuoteButton className="!py-4 text-lg">{landing.hero.cta}</QuoteButton>
        <ButtonLink variant="ghost" href={contactMailto} className="!py-4 text-lg">
          {landing.contact.emailCta}
        </ButtonLink>
      </div>
      <p className="mt-8 text-white/70">
        {company.address.city}, {company.address.state}
        {' · '}
        <a className="underline" href={contactMailto}>
          {company.contactEmail}
        </a>
      </p>
    </Section>
  );
}
