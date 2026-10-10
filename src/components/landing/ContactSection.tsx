import { contactMailto } from '@/config/company';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function ContactSection() {
  const c = landing.contact;
  return (
    <Section id="contact" tone="navy" className="!pb-10 sm:!pb-12">
      <SectionHeading title={c.heading} intro={c.body} light />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <QuoteButton className="!py-4 text-lg">{landing.hero.cta}</QuoteButton>
        <ButtonLink variant="ghost" href={contactMailto} className="!py-4 text-lg">
          {landing.contact.emailCta}
        </ButtonLink>
      </div>
    </Section>
  );
}
