import { About } from '@/components/landing/About';
import { ContactSection } from '@/components/landing/ContactSection';
import { Gallery } from '@/components/landing/Gallery';
import { Hero } from '@/components/landing/Hero';
import { ServiceAreaPlaceholder } from '@/components/landing/ServiceAreaPlaceholder';
import { Services } from '@/components/landing/Services';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { TrustBar } from '@/components/landing/TrustBar';
import { TrustLogos } from '@/components/landing/TrustLogos';

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Hero />
        <TrustBar />
        <About />
        <Services />
        <ServiceAreaPlaceholder />
        <Gallery />
        <TrustLogos />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
