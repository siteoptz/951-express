// Terms & Conditions. A standard auto-transport draft in plain American English, written from our actual booking rules.
// Numbers come from config so the terms cannot drift from what the site charges.
// TODO(client): every TODO(client) below is a default the client must confirm. An attorney should review the whole
// document before the site takes live deposits (see docs/CLIENT_INPUTS.md). The markers stay in this source file only:
// the public page shows the default text.
import { booking } from '@/config/booking';
import { company } from '@/config/company';
import { pricing, topDeck } from '@/config/pricing';
import { deliveryWindowText } from '@/lib/delivery-window';
import { money } from '@/lib/format';

export type TermsBlock = string | { list: string[] };
export type TermsSection = { id: string; title: string; body: TermsBlock[] };

const depositText =
  pricing.deposit.type === 'flat'
    ? `a flat deposit of ${money(pricing.deposit.amountCents)}`
    : `a deposit of ${pricing.deposit.value}% of the transport price`;
const topDeckPrice = money(topDeck.surchargeCents);
// TODO(client): cancellation window (days before the first day of the pickup week).
const refundDays = 7;
// TODO(client): how long after delivery a damage claim may be filed.
const claimDays = 7;

export const termsIntro =
  'These Terms and Conditions are the agreement between you and 951 Express Inc when you book vehicle transport on this website. ' +
  'When you check the box that says you agree to them, they apply to your booking. Please read them before you pay a deposit.';

export const termsSections: TermsSection[] = [
  {
    id: 'parties-and-scope',
    title: '1. Who we are and what we do',
    body: [
      `${company.name} ("951 Express," "we," "us") is a licensed motor carrier based in ${company.address.city}, ${company.address.state} (USDOT ${company.usdot}, ${company.mc}). "You" means the person who books the transport and anyone acting for you.`,
      'We move vehicles on open carriers (open trailers) between our West region and our East region, in either direction. We do not move vehicles within the West region or within the East region. Our West region covers Southern California, Phoenix, Tucson, Yuma, and El Paso. Our East region covers parts of Alabama, Georgia, South Carolina, North Carolina, Virginia, Maryland, Delaware, and Washington, DC.',
      'The ZIP code check on our website decides whether a pickup or delivery location is in our service area. If a ZIP code is not served, we cannot book it online.',
    ],
  },
  {
    id: 'quotes-and-pricing',
    title: '2. Quotes and pricing',
    body: [
      "Our online price depends on your vehicle's size class (small sedan, large sedan, small SUV, midsize SUV, small pickup, midsize pickup, or minivan) and the route direction you choose. We set the size class from the year, make, and model you enter. If we cannot match your vehicle, you pick the closest size and we confirm it before pickup.",
      `Top Deck Load is an optional upgrade for ${topDeckPrice}. It places your vehicle on the upper deck of the trailer, which keeps it away from oil and fluid leaks from other vehicles and shields it from road debris. Top deck space is limited each week, and we show you how much is left for the week you choose. Your top deck spot is held with your booking.`,
      "Vehicles that don't run, modified vehicles, exotic or high-value vehicles (over $100,000), and large SUVs, pickups and vans require a personalized quote. You can ask for a personalized quote online. A quote request is not a booking: no deposit is taken and no space is held until you accept a quote from us.",
      'The price you accept at booking is the price you pay, as long as the information you gave us is accurate (see section 6).',
    ],
  },
  {
    id: 'deposit-and-payment',
    title: '3. Deposit and payment',
    body: [
      `To reserve your spot you pay ${depositText} when you book. We charge the deposit to your card at booking through our payment processor, Stripe. Your spot is held while you complete payment, and it is released if you do not finish in time.`,
      'The remaining balance is due at delivery and is paid to the driver. The deposit is part of your price, not an extra charge.',
      `${booking.balanceMessage} Please plan to have the balance ready in one of these forms when your vehicle arrives.`,
    ],
  },
  {
    id: 'cancellations-and-refunds',
    title: '4. Cancellations and refunds',
    body: [
      // TODO(client): confirm the refund windows below.
      {
        list: [
          `If you cancel ${refundDays} or more days before the first day of your pickup week, we refund your deposit in full.`,
          `If you cancel fewer than ${refundDays} days before the first day of your pickup week, the deposit is not refundable.`,
          'If we cancel your booking for any reason, we refund your deposit in full.',
        ],
      },
      'To cancel, email us at the address in section 14 and include your booking reference. The date we receive your email is the cancellation date.',
      // TODO(client): confirm refund timing.
      'Refunds go back to the card you paid with. Your bank decides how long it takes to show up, which is usually 5 to 10 business days.',
      'If we cannot pick up your vehicle because the information you gave us was not accurate, or because you were not available during the agreed pickup window, the cancellation terms above apply.',
    ],
  },
  {
    id: 'pickup-and-delivery-timing',
    title: '5. Pickup and delivery timing',
    body: [
      `When you book, you choose an estimated pickup week. That week is an estimate, not a guaranteed date. We contact you to confirm the pickup date within your week. Standard delivery is estimated at ${deliveryWindowText()}. That is an estimate, not a guarantee, and we confirm delivery timing once your vehicle is on the road.`,
      'Transport depends on things we do not control, including weather, road and traffic conditions, mechanical problems, and government rules such as driver hours-of-service limits. These can delay pickup or delivery. We will keep you informed and work to move your vehicle as soon as we can, but we are not responsible for delays that come from these causes.',
      'Someone you trust must be available to hand over and receive the vehicle at the agreed times and places. A large truck cannot always reach a residential street. The driver may ask to meet you at a nearby large, safe parking area.',
    ],
  },
  {
    id: 'vehicle-condition',
    title: '6. Vehicle condition and accurate information',
    body: [
      'You must tell us accurately whether your vehicle runs and drives, and whether it has been modified in any way (for example lifted or lowered, larger tires, a roof rack, a spoiler, or any change that makes it taller, wider, longer, or heavier than the factory vehicle). You must also give us the correct year, make, and model.',
      'If the vehicle is not as you described, we may charge the additional amount it costs to move it, or we may refuse to load it. If we refuse, the cancellation terms in section 4 apply.',
    ],
  },
  {
    id: 'personal-items',
    title: '7. Personal items',
    body: [
      booking.personalItemsNotice,
      // TODO(client): confirm packing rules for personal items.
      "Personal items must be in the trunk or cargo area, below window height, and secured. Items travel at the owner's risk. Our cargo insurance does not cover personal items, and we are not responsible for loss of or damage to them.",
      'You may not ship hazardous materials, flammable or explosive items, firearms or ammunition, illegal items, or anything of high value such as cash, jewelry, or important documents in or on the vehicle. We may refuse to move a vehicle that holds items we cannot carry.',
    ],
  },
  {
    id: 'preparing-your-vehicle',
    title: '8. Getting your vehicle ready',
    body: [
      {
        list: [
          'Remove all toll tags and transponders (such as E-ZPass, FasTrak, or SunPass), or place them in a shielded bag. Tolls charged while your vehicle is on the truck are your responsibility.',
          'Leave one-quarter tank of fuel or less.',
          'Tell the driver about any fluid leaks, warning lights, flat tires, or mechanical problems before loading.',
          'Give the driver a working key, and turn off any alarm. The vehicle must be easy to start, drive, and load.',
          'Remove or secure loose parts and accessories, and fold in antennas and mirrors.',
          'Wash the vehicle if you can, so that its condition is easy to see at inspection.',
        ],
      },
    ],
  },
  {
    id: 'inspection-and-claims',
    title: '9. Inspection, Bill of Lading, and damage claims',
    body: [
      'At pickup, the driver inspects your vehicle with you (or your representative) and records its condition on a Bill of Lading (BOL). Please check that the BOL is correct before you sign it.',
      'At delivery, inspect your vehicle before you sign the BOL and before the driver leaves. Note any new damage on the BOL at that time. Damage that is not noted on the BOL at delivery may be harder to claim, and we may deny it.',
      `To file a claim, email us within ${claimDays} days of delivery with your booking reference, a copy of the BOL, clear photos of the damage, and a repair estimate. We review each claim promptly and tell you our decision in writing.`,
    ],
  },
  {
    id: 'insurance',
    title: '10. Insurance',
    body: [
      `${company.insurance} (USDOT ${company.usdot}, ${company.mc}).`,
      'Our cargo coverage applies to damage to your vehicle that happens while it is in our care during transport. It does not cover personal items, damage that was already on the vehicle, or normal wear. Your own auto insurance may offer additional protection, so you may want to ask your insurer.',
    ],
  },
  {
    id: 'liability',
    title: '11. Limitation of liability',
    body: [
      'To the fullest extent that the law allows, our liability for loss of or damage to your vehicle is limited to the lesser of the cost to repair it or its fair market value, and never more than our cargo limit. We are not liable for indirect or consequential losses, such as loss of use, rental car costs, lost income, or the cost of a delayed delivery.',
      'Nothing in these terms limits any right you have under federal or California law that cannot be limited by agreement.',
    ],
  },
  {
    id: 'indemnity',
    title: '12. Your responsibility (indemnity)',
    body: [
      "You confirm that you own the vehicle or have the owner's permission to ship it. You agree to cover our reasonable costs and losses if a third party makes a claim because the information you gave us was inaccurate, because you shipped a prohibited item, or because you did not have the right to ship the vehicle.",
    ],
  },
  {
    id: 'governing-law',
    title: '13. Governing law and disputes',
    body: [
      // TODO(client): attorney to confirm governing law and venue.
      'These terms are governed by the laws of the State of California, without regard to its conflict-of-law rules. Any dispute that we cannot resolve together will be brought in the state or federal courts located in Riverside County, California, and you and 951 Express consent to those courts.',
      'Before taking any formal step, please email us so we can try to resolve the problem directly.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    body: [
      `Questions, cancellations, and claims: ${company.contactEmail}`,
      'We may update these terms from time to time. The version you accept when you book (shown at the top of this page, and saved with your booking) is the one that applies to your booking.',
    ],
  },
];
