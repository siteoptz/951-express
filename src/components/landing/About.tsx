import Image from 'next/image';
import { landing } from '@/content/landing';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function About() {
  const a = landing.about;
  return (
    <Section id="about">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading title={a.heading} />
          {a.paragraphs.map((p) => (
            <p key={p} className="mb-4 text-lg text-muted">
              {p}
            </p>
          ))}
        </div>
        <Image
          src="/images/about/white-cascadia-loaded.webp"
          alt={a.imageAlt}
          width={1600}
          height={1200}
          sizes="(min-width: 1024px) 560px, 100vw"
          className="w-full rounded-2xl object-cover shadow-lg"
        />
      </div>
    </Section>
  );
}
