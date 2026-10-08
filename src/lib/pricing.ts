import {
  pricing as defaultPricing,
  sizeClasses,
  topDeck,
  type SizeClassId,
} from '@/config/pricing';

export type Surcharge = { id: 'inoperable' | 'modified' | 'topDeck'; label: string; cents: number };

export type QuoteInput = {
  sizeClass: SizeClassId | 'large';
  operable: boolean;
  modified: boolean;
  topDeck?: boolean;
  /** True when the customer picked the class because the vehicle was unknown. */
  needsReview?: boolean;
};

export type Quote = {
  baseCents: number;
  surcharges: Surcharge[];
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  needsReview: boolean;
};

export type QuoteResult = Quote | { quoteRequired: true };

export function calculateQuote(
  input: QuoteInput,
  cfg: typeof defaultPricing = defaultPricing,
): QuoteResult {
  if (input.sizeClass === 'large') return { quoteRequired: true };
  const base = sizeClasses.find((c) => c.id === input.sizeClass);
  if (!base) throw new Error(`Unknown size class: ${input.sizeClass}`);

  const surcharges: Surcharge[] = [];
  let needsReview = input.needsReview ?? false;
  if (!input.operable)
    surcharges.push({
      id: 'inoperable',
      label: 'Inoperable vehicle',
      cents: cfg.inoperableSurchargeCents,
    });
  if (input.modified) {
    if (cfg.modifiedPolicy === 'review') needsReview = true;
    else
      surcharges.push({
        id: 'modified',
        label: 'Modified vehicle',
        cents: cfg.modifiedSurchargeCents,
      });
  }
  if (input.topDeck)
    surcharges.push({ id: 'topDeck', label: topDeck.label, cents: topDeck.surchargeCents });

  const totalCents = base.baseCents + surcharges.reduce((sum, s) => sum + s.cents, 0);
  const depositCents = Math.round((totalCents * cfg.deposit.value) / 100);
  return {
    baseCents: base.baseCents,
    surcharges,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    needsReview,
  };
}
