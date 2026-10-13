import {
  pricing as defaultPricing,
  type PricingConfig,
  sizeClasses,
  topDeck,
  type SizeClassId,
} from '@/config/pricing';

export type Surcharge = { id: 'topDeck'; label: string; cents: number };

export type QuoteInput = {
  sizeClass: SizeClassId | 'large';
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
  cfg: PricingConfig = defaultPricing,
): QuoteResult {
  if (input.sizeClass === 'large') return { quoteRequired: true };
  const base = sizeClasses.find((c) => c.id === input.sizeClass);
  if (!base) throw new Error(`Unknown size class: ${input.sizeClass}`);

  const surcharges: Surcharge[] = [];
  if (input.topDeck)
    surcharges.push({ id: 'topDeck', label: topDeck.label, cents: topDeck.surchargeCents });

  const totalCents = base.baseCents + surcharges.reduce((sum, s) => sum + s.cents, 0);
  const depositCents =
    cfg.deposit.type === 'flat'
      ? Math.min(cfg.deposit.amountCents, totalCents)
      : Math.round((totalCents * cfg.deposit.value) / 100);
  return {
    baseCents: base.baseCents,
    surcharges,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    needsReview: input.needsReview ?? false,
  };
}
