# 951 Express Inc: Landing Page & Online Booking System

Built by SiteOptz (Antonio Mendoza) for 951 Express Inc, a licensed auto transport carrier in Corona, CA
(USDOT 4020917, MC 1516594). Fixed-fee project ($1,750). Spec source: the signed proposal
"SiteOptz-Proposal-951-Express-Landing-Page-Booking.pdf". The step-by-step build plan is `docs/BUILD_PLAN.md`.
Work through it one phase at a time. Do not start a phase until the previous phase's checks pass.

## What we are building
One landing page with a booking modal:
1. **Qualify & Quote:** pickup/delivery ZIPs checked against two regions, WEST and EAST, defined only by the
   client's ZIP lists (`data/raw/`, built into `src/data/zips/`). A shipment must cross regions; same-region
   moves are rejected. The two routes, `west-to-east` and `east-to-west`, each have 12 spots per week. Once the
   pickup ZIP resolves, the UI shows "Shipping West → East" (or East → West) and the delivery ZIP accepts only the
   opposite list. Vehicle year/make/model sets a size class (7 priced classes); unknown vehicles let the
   customer pick a class and the booking gets `needsReview`. Large SUVs and pickups have no online price: they
   get a "Request a personalized quote" form that stores a lead (no deposit, no hold). Options: operable and
   modified radios, a Standard / Top Deck Load (+$150) radio, personal items radio (Yes shows "100 lbs included.
   Anything over 100 lbs is at the driver's discretion."), a pickup-week calendar limited to 12 spots per route
   per week, and a required Terms & Conditions checkbox linked to /terms.
2. **Cart & Deposit:** price breakdown plus deposit paid through Stripe Embedded Checkout.
3. **Customer details** (only after payment): name, phone, email, address, pickup and delivery addresses, notes.
4. **Email:** full booking record to the 951 Express team, plus a confirmation to the customer.
Also: service-area map (from `src/data/zips/coverage.json`), company sections with real photography, /terms page,
password-protected /admin.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel (Git-connected).
- Postgres: Neon via the Vercel Marketplace. Drizzle ORM with the `neon-serverless` (Pool) driver, which
  we need for transactions.
- Stripe Embedded Checkout (`ui_mode: 'embedded'`, `redirect_on_completion: 'never'`) + webhooks.
- Resend + React Email for transactional email.
- NHTSA vPIC API for vehicle makes and models (free, no key).
- Map: `d3-geo` + `us-atlas` + `topojson-client`, rendered as an SVG React component (no map-library dependency).
- Validation: `zod` on both client and server. Tests: Vitest (unit, 95% coverage gate on `src/lib`) + Playwright (e2e).
- ZIP data: `node scripts/build-zip-data.mjs` regenerates `src/data/zips/*` from `data/raw/`; the `zipcodes` package validates it.

## Rules that must never be broken
- **The server is the only source of truth for price and capacity.** Never trust a total, deposit, route,
  or availability sent from the browser. Recompute everything server-side before creating a hold or a
  Stripe session.
- **The full ZIP lists are server-only.** Import `src/data/zips/{west,east}.json` only from server modules
  (`*.server.ts`, with `import 'server-only'`). Client code may use `coverage.json` only.
- **Capacity must be race-safe.** Check and insert holds inside one DB transaction guarded by
  `pg_advisory_xact_lock(route_id, week_number)`. A concurrency test (13 simultaneous holds, exactly 12
  succeed) must stay green.
- A booking is only "paid" when Stripe says so (webhook, or `checkout.sessions.retrieve` with
  `payment_status === 'paid'`). The client `onComplete` callback is UX only.
- Webhook handlers are idempotent and verify the Stripe signature against the raw request body.
- Business values (routes, states, rates, surcharges, deposit, capacity, copy) live in config or DB tables,
  never hard-coded in components. Placeholder values are marked `// TODO(client)`.
- No secrets in the repo. Every env var is listed in `.env.example`.
- Images go through `next/image`, with meaningful `alt` text. Do not commit originals over ~500 KB; resize first.
- American English in all copy and code comments.

## Brand (from the approved proposal mockups)
- Navy `#0E1A2B` (nav and hero), deep blue `#17304F` to `#1D3B60` (hero gradient), amber `#F5A524`
  (primary buttons and accents), success `#1F9D55`, full/unavailable `#C8343B`, soft background `#F3F5F8`.
- Wordmark "951 **EXPRESS**", with EXPRESS in amber, until the client supplies a logo file.
- Headline: "Your vehicle, delivered safely and on schedule." Primary CTA: "Get My Instant Quote".

## Commands
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (Vitest + coverage), `npm run e2e` (Playwright with vPIC mocked; `npm run e2e:live` is the real-NHTSA smoke test; uses the DATABASE_URL in .env.local: a dev branch only)
- `npm run db:generate` / `npm run db:migrate` / `npm run db:seed` (Drizzle Kit)
- Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Definition of done for any change
`npm run lint && npm run typecheck && npm test && npm run build` all pass, and the affected screen has been
viewed at 390px and 1280px widths.
