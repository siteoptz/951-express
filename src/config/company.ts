// Company facts. Only things the client has confirmed go here.
export const company = {
  name: '951 Express Inc',
  // The one way to reach us from the site (replaces any phone number). TODO(client): confirm this is the public address.
  contactEmail: '951.dispatcher@gmail.com',
  address: {
    street: '', // TODO(client): street address (hidden until set)
    city: 'Corona',
    state: 'CA',
    zip: '', // TODO(client)
  },
  // Used only on the dispatch sheet PDF (not on the site, in emails or in the Terms), from Cal's own dispatch sheet.
  // TODO(client): confirm this is the address to print on the sheet.
  dispatchAddress: '2108 Collett Ave Apt 204, Corona, CA 92879',
  // The "Contact:" line of the carrier block on the dispatch sheet (the sheet adds dispatchPhone below).
  // TODO(client): confirm Jesse Calzada is the right contact name to print.
  dispatchContact: 'Jesse Calzada',
  // Cal's phone for the dispatch sheet PDF ONLY (approved by Cal). Never render it on the website or in any customer
  // or team email body; src/config/company-phone.test.ts fails if it appears there.
  dispatchPhone: '(951) 407-8198',
  usdot: '4020917',
  mc: 'MC-1516594',
  insurance: 'Fully licensed and bonded with a cargo limit of $250,000 per occurrence',
  cargoLimit: '$250,000',
  // Add a stat here only after the client confirms it (for example years in operation). It shows in the trust bar.
  confirmedStats: [] as { value: string; label: string }[],
  logo: {
    alt: '951 Express Inc. logo',
    // Largest display size in CSS pixels (the logo is 2.37:1); the page scales it down on phones. The files are in
    // public/images/logos at 2x of these sizes (see scripts/optimize-images.mjs).
    header: { src: '/images/logos/logo-header@2x.webp', width: 171, height: 72 },
    footer: { src: '/images/logos/logo-footer@2x.webp', width: 227, height: 96 },
    email: { path: '/images/logos/logo-email.png', width: 190, height: 80 },
  },
} as const;

export const contactMailto = `mailto:${company.contactEmail}`;
