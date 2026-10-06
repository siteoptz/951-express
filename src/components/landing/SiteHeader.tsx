'use client';

import { useState } from 'react';
import { landing } from '@/content/landing';
import { QuoteButton } from '@/components/booking/QuoteButton';
import { Container } from '@/components/ui/Container';
import { Wordmark } from './Wordmark';

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-md">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" aria-label="951 Express home">
          <Wordmark />
        </a>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {landing.nav.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white/85 hover:text-amber"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <QuoteButton className="!px-4 !py-2 text-sm">{landing.headerCta}</QuoteButton>
          <button
            type="button"
            className="rounded p-2 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </Container>
      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="border-t border-white/10 bg-navy md:hidden"
        >
          <Container className="flex flex-col py-2">
            {landing.nav.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="py-3 text-base font-medium text-white/90"
              >
                {l.label}
              </a>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
