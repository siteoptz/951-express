// All landing-page copy lives here. TODO(client): review every line with 951 Express.
export const landing = {
  nav: [
    { label: 'About', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Service Area', href: '#service-area' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Contact', href: '#contact' },
  ],
  headerCta: 'Get My Quote',
  hero: {
    kicker: 'Licensed & Insured Auto Transport',
    title: 'Your vehicle, delivered safely and on schedule.',
    subhead:
      'Enclosed-quality care on an open carrier built for volume. Check your route, see your price, and reserve your spot in minutes.',
    cta: 'Get My Instant Quote',
    imageAlt:
      'A red 951 Express car hauler loaded with six vehicles, parked on a gravel lot under a blue sky.',
  },
  about: {
    heading: 'A carrier you can look up and trust',
    paragraphs: [
      '951 Express Inc is a licensed auto transport carrier based in Corona, California. We run our own trucks, so the people who quote your move are the people who deliver it.',
      'Every vehicle is loaded, secured, and tracked with care. You get a clear price up front, a reserved pickup week, and a driver who answers the phone.',
    ],
    imageAlt: 'A white 951 Express car hauler loaded with sedans, SUVs, and a classic car.',
  },
  services: {
    heading: 'Transport built around your vehicle',
    intro: 'Open carrier transport for individuals, dealers, and everyone in between.',
    items: [
      {
        title: 'Open-carrier transport',
        body: 'Safe, cost-effective multi-car hauling on modern, well-maintained trailers.',
      },
      {
        title: 'Dealer & business moves',
        body: 'Reliable scheduling for dealerships, auctions, and fleets that move vehicles every week.',
      },
      {
        title: 'Personal vehicles',
        body: 'Moving, buying online, or sending a car to family. We handle cars, SUVs, and trucks.',
      },
    ],
    imageAlt: 'The front of a white 951 Express truck with chrome wheels and bumper.',
  },
  serviceArea: {
    heading: 'Where we haul',
    body: 'We run weekly routes out of Corona, CA. Enter your ZIP codes in the quote tool to confirm your route.',
    placeholder: 'Interactive service-area map coming soon.',
  },
  gallery: {
    heading: 'On the road',
    intro: 'A look at our trucks and the vehicles we move.',
    items: [
      {
        src: '/images/gallery/red-cascadia-night.webp',
        width: 1600,
        height: 1200,
        alt: 'A red 951 Express truck loaded with cars at a fuel stop after dark.',
      },
      {
        src: '/images/gallery/hauler-black-white.webp',
        width: 1500,
        height: 1500,
        alt: 'A black-and-white photo of a 951 Express truck hauling eight vehicles.',
      },
      {
        src: '/images/gallery/red-cascadia-daylight.webp',
        width: 1600,
        height: 1200,
        alt: 'A red 951 Express Cascadia hauling a loaded car carrier under a clear blue sky.',
      },
      {
        src: '/images/gallery/white-cascadia-daylight.webp',
        width: 1600,
        height: 1200,
        alt: 'A white 951 Express Cascadia with a full load of cars at a truck stop.',
      },
      {
        src: '/images/gallery/loaded-hauler-i20.webp',
        width: 1600,
        height: 1200,
        alt: 'A 951 Express hauler loaded with SUVs and sedans pulled over beside the Interstate 20 West sign.',
      },
      {
        src: '/images/gallery/loaded-hauler-night.webp',
        width: 1600,
        height: 1200,
        alt: 'A 951 Express car hauler fully loaded with SUVs and sedans, lit up in a parking lot at night.',
      },
    ],
  },
  trustLogos: {
    heading: 'Credentials & partners',
    placeholder: 'Logos and badges will appear here once supplied.',
  },
  contact: {
    heading: 'Questions? Talk to a person.',
    body: 'Call us or start a quote. We reply fast.',
  },
  footer: { cta: 'Get My Instant Quote' },
} as const;
