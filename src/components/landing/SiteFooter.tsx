import { company } from '@/config/company';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { Container } from '@/components/ui/Container';
import { CopyrightYear } from './CopyrightYear';
import { Wordmark } from './Wordmark';

export function SiteFooter() {
  const a = company.address;
  const street = [a.street, `${a.city}, ${a.state} ${a.zip}`.trim()].filter(Boolean).join(', ');
  return (
    <footer className="bg-navy pb-10 pt-12 text-white/80">
      <Container>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Wordmark className="text-white" />
            <address className="mt-3 not-italic">
              <p>{street}</p>
              <p>
                <a className="hover:text-amber" href={company.phoneHref}>
                  {company.phone}
                </a>
              </p>
              {company.email && (
                <p>
                  <a className="hover:text-amber" href={`mailto:${company.email}`}>
                    {company.email}
                  </a>
                </p>
              )}
            </address>
          </div>
          <QuoteButton>{landing.footer.cta}</QuoteButton>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm sm:flex-row sm:justify-between">
          <p>
            © <CopyrightYear /> {company.name}. USDOT {company.usdot} · MC {company.mc}
          </p>
          <a href="/terms" className="hover:text-amber">
            Terms &amp; Conditions
          </a>
        </div>
      </Container>
    </footer>
  );
}
