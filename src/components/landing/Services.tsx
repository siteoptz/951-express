import Image from 'next/image';
import { landing } from '@/content/landing';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function Services() {
  const s = landing.services;
  return (
    <Section id="services" tone="soft">
      <SectionHeading title={s.heading} intro={s.intro} />
      <div className="grid gap-8 lg:grid-cols-5">
        <Image
          src="/images/services/white-cascadia-front.webp"
          alt={s.imageAlt}
          width={1500}
          height={1500}
          sizes="(min-width: 1024px) 440px, 100vw"
          className="aspect-[4/3] w-full rounded-2xl object-cover object-[50%_60%] shadow-lg lg:col-span-2 lg:aspect-auto lg:h-full"
        />
        <div className="grid gap-5 lg:col-span-3">
          {s.items.map((item) => (
            <Card key={item.title}>
              <h3 className="font-display text-2xl font-extrabold uppercase">{item.title}</h3>
              <p className="mt-2 text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
