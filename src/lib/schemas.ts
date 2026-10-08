import { z } from 'zod';
import { sizeClassIds } from '@/config/pricing';

/** Class the customer may pick when the vehicle is unknown. The server re-classifies and may ignore it. */
export const selectableClass = z.enum([...sizeClassIds, 'large']);

/** "Request a personalized quote" form for large vehicles. No deposit and no spot hold. */
export const quoteRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.email().max(200),
  pickupZip: z.string().regex(/^\d{5}$/),
  deliveryZip: z.string().regex(/^\d{5}$/),
  vehicle: z.object({
    year: z.number().int().min(1900).max(2100),
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(80),
  }),
  operable: z.boolean(),
  modified: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
