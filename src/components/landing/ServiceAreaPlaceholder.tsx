import { landing } from '@/content/landing';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

// The interactive map arrives in Phase 2; keep the #service-area anchor.
export function ServiceAreaPlaceholder() {
  const s = landing.serviceArea;
  return (
    <Section id="service-area" tone="navy">
      <SectionHeading title={s.heading} intro={s.body} light />
      <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-white/30 text-white/70">
        {s.placeholder}
      </div>
    </Section>
  );
}
