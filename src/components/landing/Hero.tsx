import Image from 'next/image';
import { company } from '@/config/company';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Hero() {
  const h = landing.hero;
  return (
    <section className="relative isolate overflow-hidden bg-navy text-white sm:flex sm:min-h-[760px] sm:items-end">
      {/* The truck sits in the upper half of the photo. On mobile the whole 4:3 photo shows above the
          copy; on larger screens the crop is anchored to the bottom so the truck stays near the top. */}
      <div className="relative aspect-[4/3] w-full sm:absolute sm:inset-0 sm:-z-10 sm:aspect-auto">
        <Image
          src="/images/hero/red-cascadia-profile.webp"
          alt={h.imageAlt}
          fill
          preload
          sizes="100vw"
          className="object-cover object-[50%_bottom]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-navy/0 sm:via-navy/70"
          aria-hidden="true"
        />
      </div>
      <Container className="relative -mt-12 pb-12 sm:mt-0 sm:pb-16 sm:pt-96">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber">{h.kicker}</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-extrabold uppercase leading-[0.95] sm:text-7xl">
          {h.title}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/85">{h.subhead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <QuoteButton className="!py-4 text-lg">{h.cta}</QuoteButton>
          <ButtonLink variant="ghost" href={company.phoneHref} className="!py-4 text-lg">
            Call {company.phone}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
