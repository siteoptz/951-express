import { company, contactMailto } from '@/config/company';
import { Container } from '@/components/ui/Container';
import { CopyrightYear } from './CopyrightYear';
import { Logo } from './Logo';

export function SiteFooter() {
  const a = company.address;
  const street = [a.street, `${a.city}, ${a.state} ${a.zip}`.trim()].filter(Boolean).join(', ');
  return (
    <footer className="bg-navy pb-10 pt-0 text-white/80">
      <Container>
        <div className="border-t border-white/10 pt-10">
          <div>
            <Logo size="footer" />
            <address className="mt-3 not-italic">
              <p>{street}</p>
              <p>
                <a className="hover:text-accent" href={contactMailto}>
                  {company.contactEmail}
                </a>
              </p>
              <p className="mt-2 max-w-md text-sm text-white/70">{company.insurance}</p>
            </address>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm sm:flex-row sm:justify-between">
          <p>
            © <CopyrightYear /> {company.name}. USDOT {company.usdot} ·{' '}
            <span className="whitespace-nowrap">{company.mc}</span>
          </p>
          <a href="/terms" className="hover:text-accent">
            Terms &amp; Conditions
          </a>
        </div>
      </Container>
    </footer>
  );
}
