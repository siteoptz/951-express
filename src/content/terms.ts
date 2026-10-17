// Terms & Conditions: Cal's final text (October 17, 2026). The company name, USDOT number, contact email, delivery
// estimate, personal-items rule and balance methods come from config so the terms cannot drift from the site; the rest
// is the client's wording, verbatim. Lettered sub-items are listed without their "a)" labels: /terms numbers them.
import { booking } from '@/config/booking';
import { company } from '@/config/company';
import { deliveryWindowText } from '@/lib/delivery-window';

export type TermsBlock = string | { list: string[] };
export type TermsSection = { id: string; title: string; body: TermsBlock[] };

const name = company.name;
const methods = booking.balanceMethods;
const methodList = `${methods.slice(0, -1).join(', ')}, or ${methods[methods.length - 1]}`;

export const termsIntro =
  `This agreement is entered into by and between ${name}, USDOT #${company.usdot}, and the vehicle owner, authorized agent, or entity booking the transport (hereinafter referred to as the "Customer"). ` +
  `By booking a shipment with ${name}, the Customer agrees to all terms and conditions outlined below.`;

export const termsClosing =
  'By proceeding with the booking, the Customer warrants that they have read, understand, and agree to be bound by these Terms and Conditions in their entirety.';

export const termsSections: TermsSection[] = [
  {
    id: 'scope-of-services',
    title: '1. Scope of services',
    body: [
      `${name} is a licensed motor carrier. ${name} will transport the Customer's vehicle(s) directly on its own fleet of commercial car haulers.`,
    ],
  },
  {
    id: 'pickup-and-delivery-timing',
    title: '2. Pickup and delivery timing',
    body: [
      `When the Customer books, the Customer chooses an estimated pickup week. That week is an estimate, not a guaranteed date. ${name} will contact the Customer to confirm the pickup date within the Customer's week. Standard delivery is estimated at ${deliveryWindowText()}. That is an estimate, not a guarantee, and ${name} confirms delivery timing once the Customer's vehicle is on the road. Unforeseen circumstances including, but not limited to, weather, traffic, road conditions, mechanical breakdowns, and mandatory FMCSA driver hours-of-service regulations may cause delays. ${name} shall not be liable for any expenses incurred due to delays, including but not limited to rental car fees, hotel accommodations, or lost wages.`,
    ],
  },
  {
    id: 'pickup-and-delivery-location',
    title: '3. Pickup and delivery location',
    body: [
      `${name}'s driver will pick up and deliver the vehicle as close to the requested locations as safely and legally possible. If the requested location has restricted access for a full-size commercial semi-truck (e.g., narrow streets, low-hanging trees, gated communities, weight limits), the Customer agrees to meet the driver at a mutually agreed-upon safe location, such as a nearby large parking lot.`,
    ],
  },
  {
    id: 'vehicle-description-and-preparation',
    title: '4. Vehicle description, condition, and preparation',
    body: [
      'The Customer is responsible for providing accurate vehicle details and preparing the vehicle for transport.',
      {
        list: [
          'Accurate Disclosure: The Customer must accurately disclose the correct year, make, and model. The Customer must also accurately state whether the vehicle runs and drives, and whether it has been modified in any way (for example, lifted or lowered, larger tires, a roof rack, a spoiler, or any change that makes it taller, wider, longer, or heavier than the factory vehicle).',
          `Misrepresentation: If the vehicle is not as the Customer described, ${name} may charge the additional amount it costs to move it, or ${name} may refuse to load it. If ${name} refuses to load the vehicle due to an inaccurate description, the cancellation terms in Section 11 apply (the deposit is not refundable).`,
          'Preparation: All loose parts, fragile accessories, low-hanging spoilers, antennas, and specialty racks must be removed or properly secured.',
          `Toll Transponders: The Customer must remove or deactivate all toll transponders (e.g., FasTrak, EZ Pass). ${name} is not responsible for any toll charges incurred while the vehicle is in transit on ${name}'s trailer.`,
          'Operability: The vehicle must be handed over in safe, running condition with a working battery and brakes, unless explicitly booked as an "Inoperable" vehicle. If a vehicle becomes inoperable during transport, an additional inoperable loading/unloading fee will be added to the final balance.',
          'Alarms: Any alarm systems must be disabled. If an alarm triggers and cannot be silenced, the driver is authorized to silence it by any means necessary without liability.',
        ],
      },
    ],
  },
  {
    id: 'dealership-auction-and-third-party-releases',
    title: '5. Dealership, auction, and third-party releases (CarMax, etc.)',
    body: [
      `If ${name} is picking up or delivering the vehicle from a third-party facility, dealership (such as CarMax), or auto auction, the following conditions apply:`,
      {
        list: [
          `Required Documentation: The Customer is solely responsible for providing ${name} with all required release documents (e.g., Gate Pass, Buyer's Order, Stock Number, Lot Number, or VIN) prior to dispatch.`,
          `Refusal of Release: If the facility refuses to release the vehicle to ${name} because the Customer failed to provide the correct paperwork, or because the vehicle is not fully paid for, a "dry run" cancellation fee will apply, and the deposit becomes non-refundable.`,
        ],
      },
    ],
  },
  {
    id: 'personal-property',
    title: '6. Personal property',
    body: [
      `The Department of Transportation (DOT) regulates the transport of personal items in vehicles on auto haulers. The Customer may place up to 100 lbs of personal items confined solely to the vehicle's trunk. ${name} is strictly NOT liable for any loss, theft, or damage to personal property left in the vehicle, nor is ${name} liable for any damage to the vehicle caused by the shifting of personal property during transit. No illegal substances, firearms, explosives, or hazardous materials are permitted.`,
    ],
  },
  {
    id: 'inspections-and-bill-of-lading',
    title: '7. Inspections and the Bill of Lading (BOL)',
    body: [
      'The Bill of Lading (BOL) is the primary binding document for vehicle condition and liability.',
      {
        list: [
          `At pickup, the Customer (or facility agent) and the driver will inspect the exterior of the vehicle and note any pre-existing damage on the BOL. The Customer or agent must sign the BOL to release the vehicle to ${name}.`,
          'At delivery, the Customer and the driver must thoroughly inspect the vehicle again BEFORE the driver departs.',
          `ALL DAMAGE MUST BE NOTED ON THE BOL AT THE TIME OF DELIVERY. If the Customer (or the Customer's designated receiving agent) signs the final BOL without noting any new damage, it acts as a final release of liability. ${name} will not be held responsible for any damage claims made after the BOL has been signed clear.`,
        ],
      },
    ],
  },
  {
    id: 'liability-exclusions',
    title: '8. Liability exclusions',
    body: [
      `Under federal law, ${name} is relieved of liability for damage resulting from the following specific causes:`,
      {
        list: [
          'Acts of God: Unforeseeable natural events (e.g., hail, flooding, storms, earthquakes) that could not be prevented by reasonable care.',
          "Act of the Shipper: Damage resulting from the Customer's election to ship the vehicle via an open-air transport trailer rather than an enclosed trailer, which inherently exposes the vehicle to standard weather conditions and road debris (e.g., rock chips, cracked windshields).",
          `Inherent Vice or Nature of the Goods: This includes mechanical, exhaust, fluid leaks, or electrical failures. Because ${name} does not operate the vehicle for daily use, failure of internal components (e.g., engine, transmission, battery, alignment) is considered an inherent vice of the vehicle unless direct external impact or carrier negligence is proven.`,
          "Damage caused by the Customer's vehicle leaking fluids (oil, coolant, brake fluid) during transport.",
          'Expansion of pre-existing damage, such as a minor windshield chip expanding due to temperature changes.',
          'Hidden or undetectable damage due to the vehicle being dirty, wet, snow-covered, or inspected in poor lighting.',
          'Damage to tie-downs, exhaust systems, or undercarriage components that result from standard loading/unloading of lowered, modified, or inoperable vehicles requiring winching, unless modifications were explicitly disclosed in writing prior to booking.',
          `Diminished Value & Loss of Use: ${name} shall not be liable for any claims of diminished value, depreciation, loss of use, or consequential damages of any kind.`,
        ],
      },
    ],
  },
  {
    id: 'insurance-and-claims',
    title: '9. Insurance and claims',
    body: [
      `${name} maintains active Cargo and Auto Liability insurance as required by law. In the event of damage that occurred during transit (and was properly documented on the BOL at delivery), the Customer must submit a claim directly to ${name}. ${name} will process the claim through its insurance provider. ${name}'s liability is strictly limited to the cost of repair or the actual cash value of the vehicle, whichever is less.`,
    ],
  },
  {
    id: 'deposits-and-payments',
    title: '10. Deposits and payments',
    body: [
      {
        list: [
          'Deposits are subject to the cancellation and refund policies outlined in Section 11.',
          `The remaining balance is due at the time of delivery and must be paid directly to the driver by ${methodList} only. Credit cards are not accepted for the balance. A corporate billing arrangement is possible only if explicitly approved by ${name} in advance. Third-party facilities (like CarMax) will not issue COD payments on behalf of the Customer.`,
          `Right to Lien: If the Customer fails to provide full payment upon delivery, ${name} claims a Carrier's Lien on the vehicle. ${name} has the legal right to place the vehicle in a secure storage facility. All resulting storage fees, towing fees, and re-delivery charges will be the sole responsibility of the Customer.`,
        ],
      },
    ],
  },
  {
    id: 'cancellation-and-refund-policy',
    title: '11. Cancellation and refund policy',
    body: [
      {
        list: [
          `If the Customer cancels 7 or more days before the first day of the Customer's pickup week, ${name} will refund the deposit in full.`,
          "If the Customer cancels fewer than 7 days before the first day of the Customer's pickup week, the deposit is not refundable.",
          `If ${name} cancels the booking for any reason, ${name} will refund the deposit in full.`,
          `To cancel, the Customer must email ${name} at the contact address provided in Section 14 and include the booking reference. The date ${name} receives the email is the cancellation date.`,
          "Refunds go back to the card the Customer paid with. The Customer's bank decides how long it takes to show up, which is usually 5 to 10 business days.",
          `If ${name} cannot pick up the vehicle because the information the Customer gave ${name} was not accurate, or because the Customer was not available during the agreed pickup window, the cancellation terms above apply (the deposit is not refundable).`,
        ],
      },
    ],
  },
  {
    id: 'indemnification',
    title: '12. Indemnification',
    body: [
      `The Customer agrees to indemnify, defend, and hold ${name} harmless from any and all claims, losses, damages, or legal expenses (including attorney's fees) arising out of the Customer's breach of these terms, the Customer's failure to properly prepare the vehicle, or the inclusion of illegal/hazardous materials inside the vehicle.`,
    ],
  },
  {
    id: 'governing-law',
    title: '13. Governing law',
    body: [
      'This agreement shall be governed by and construed in accordance with the laws of the State of California. Any legal action arising out of this agreement shall be filed in the appropriate state or federal courts located in California.',
    ],
  },
  {
    id: 'contact-information',
    title: '14. Contact information',
    body: [
      `For all questions, cancellations, and claims, the Customer must contact ${name} via email at ${company.contactEmail}.`,
    ],
  },
  {
    id: 'modification-of-terms',
    title: '15. Modification of terms',
    body: [
      `${name} may update these terms from time to time. The version of the terms and conditions that the Customer accepts at the time of booking (as saved with the Customer's booking) is the version that legally applies to the Customer's booking.`,
    ],
  },
];
