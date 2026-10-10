import { About } from '@/components/landing/About';
import { ContactSection } from '@/components/landing/ContactSection';
import { Gallery } from '@/components/landing/Gallery';
import { Hero } from '@/components/landing/Hero';
import { ServiceAreaMap } from '@/components/landing/ServiceAreaMap';
import { Services } from '@/components/landing/Services';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { TrustBar } from '@/components/landing/TrustBar';

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Hero />
        <TrustBar />
        <About />
        <Services />
        <ServiceAreaMap />
        <Gallery />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
