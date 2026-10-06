import { landing } from '@/content/landing';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

// Placeholder until the client supplies badges/partner logos (see docs/CLIENT_INPUTS.md).
export function TrustLogos() {
  const t = landing.trustLogos;
  return (
    <Section tone="soft" className="!py-12 sm:!py-16">
      <SectionHeading title={t.heading} />
      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-black/20 text-muted">
        {t.placeholder}
      </div>
    </Section>
  );
}
