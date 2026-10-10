import 'server-only';
import Stripe from 'stripe';
import { stripeApiVersion } from '@/config/stripe';

let client: Stripe | undefined;

/** One client per server instance, from STRIPE_SECRET_KEY (test keys until launch), pinned to one API version. */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(key, { apiVersion: stripeApiVersion });
  }
  return client;
}

/** The slice of the Stripe client the booking code uses, so tests can pass a fake. */
export type StripeApi = {
  checkout: {
    sessions: {
      create: (
        params: Stripe.Checkout.SessionCreateParams,
      ) => Promise<Pick<Stripe.Checkout.Session, 'id' | 'client_secret'>>;
      retrieve: (
        id: string,
      ) => Promise<
        Pick<
          Stripe.Checkout.Session,
          'id' | 'status' | 'payment_status' | 'payment_intent' | 'customer_details'
        >
      >;
      expire: (id: string) => Promise<unknown>;
    };
  };
};
