import Image from 'next/image';
import { contactMailto } from '@/config/company';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Hero() {
  const h = landing.hero;
  return (
    <section className="relative isolate overflow-hidden bg-navy text-white sm:flex sm:min-h-[760px] sm:items-end">
      {/* The photo is square and the truck sits in its lower middle (about 35% to 72% of the height, cab on the right).
          On mobile a 4:3 crop anchored to the bottom shows the whole truck above the copy. On larger screens the
          crop is lowered (80%) so the cab and the load stay in frame and the headline sits over the road. */}
      <div className="relative aspect-[4/3] w-full sm:absolute sm:inset-0 sm:-z-10 sm:aspect-auto">
        <Image
          src="/images/hero/hauler-black-white.webp"
          alt={h.imageAlt}
          fill
          preload
          sizes="100vw"
          className="object-cover object-[50%_100%] sm:object-[50%_80%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 via-35% to-navy/0 sm:via-navy/92 sm:via-50%"
          aria-hidden="true"
        />
      </div>
      <Container className="relative -mt-12 pb-12 sm:mt-0 sm:pb-16 sm:pt-96">
        <p className="-ml-3 inline-block bg-gradient-to-r from-navy/85 via-navy/75 to-transparent py-1 pr-10 pl-3 text-sm font-bold uppercase tracking-[0.2em] text-accent [text-shadow:0_1px_3px_rgb(14_26_43/0.9)]">
          {h.kicker}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-extrabold uppercase leading-[0.95] sm:text-7xl">
          {h.title}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/85">{h.subhead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <QuoteButton className="!py-4 text-lg">{h.cta}</QuoteButton>
          <ButtonLink variant="ghost" href={contactMailto} className="!py-4 text-lg">
            {h.emailCta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
