# 951 Express Build Plan

Step-by-step plan for Claude to build the 951 Express landing page and booking system described in the
signed proposal. Read `CLAUDE.md` first. Run **one phase per session**: do the tasks, run the checks, commit,
push, confirm the Vercel preview deploy, then stop and report. Each phase ends with a prompt you can paste
to start it.

## Changes since the proposal: Cal's requests of 2026-10-13

Built in eight batches after Phase 7 (source: `docs/CAL_CHANGES_2026-10-13.md`). Each shipped on its own commit.

| Batch | Change                                                                                                                                                                                                             | Where                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 0     | Password-manager attributes on the ZIP inputs                                                                                                                                                                      | `src/lib/zip-input.ts`                                                |
| 1     | Personalized-quote routing: large SUVs, pickups and vans, inoperable, modified, exotic, over $100,000 get a lead form instead of a price (old surcharges retired)                                                  | `src/lib/eligibility.ts`, `src/config/eligibility.ts`                 |
| 2     | Flat $100 deposit; balance by Cash, Cashier's Check, or Zelle only; 7–10 day delivery estimate; Terms updated                                                                                                      | `src/config/booking.ts`, migration 0005                               |
| 3     | 6 spots per direction per week; Top Deck limits (3 SUV + 1 car slots per route per week, inside the same advisory-locked transaction); the seed only inserts missing rows, changes to live rows ship as migrations | `src/server/capacity.ts`, `src/lib/top-deck.ts`, migrations 0004–0005 |
| 4     | Vehicle entry is three typed fields; the server normalizes and stores typed and normalized values; vPIC and `/api/vehicles/*` removed                                                                              | `src/lib/vehicle-normalize.ts`, migration 0006                        |
| 5     | Address consistency: state from the ZIP, city check with a confirmed override flagged for review                                                                                                                   | `src/lib/address*.ts`, `src/server/details.ts`, migration 0007        |
| 6     | One-page dispatch sheet PDF attached to the team email; optional color, VIN and contacts in Step 3                                                                                                                 | `src/pdf/`, `src/server/dispatch-pdf.ts`, migration 0008              |
| 7     | Yuma, AZ ZIPs added to West                                                                                                                                                                                        | `data/raw/west_additions.txt`                                         |
| 8     | Hero is the black-and-white truck; red Cascadia profile is gallery item 2                                                                                                                                          | `src/components/landing/Hero.tsx`                                     |

Test gates: `npm run e2e:stripe:api` is the payment gate (signed webhook events, no iframe). `npm run e2e:stripe` adds two
real-checkout UI tests that are informational while Stripe's checkout can stall in automated browsers. `npm run e2e:email`
sends the real emails and checks the dispatch sheet attachment in Resend.

| Phase | What ships                                                                            | Proposal week |
| ----- | ------------------------------------------------------------------------------------- | ------------- |
| 0     | Repo audit, project setup, image inventory, config skeleton                           | Wk 1          |
| 1     | Design system + static landing page                                                   | Wk 1–2        |
| 2     | Interactive service-area map                                                          | Wk 2          |
| 3A    | Booking rules: ZIP regions, routing, pricing, vehicle classes (pure + tested)         | Wk 2          |
| 3B    | Remaining business logic: weeks, shared schemas (the vPIC helpers were later removed) | Wk 2          |
| 4     | Database + race-safe capacity holds                                                   | Wk 2–3        |
| 5     | Booking modal, Step 1 (Qualify & Quote)                                               | Wk 3          |
| 6     | Step 2: cart + Stripe deposit + webhooks                                              | Wk 3          |
| 7     | Step 3 details + Step 4 emails                                                        | Wk 3          |
| 8     | Terms page + admin view                                                               | Wk 3–4        |
| 9     | SEO, analytics, accessibility, performance                                            | Wk 4          |
| 10    | End-to-end QA + launch                                                                | Wk 4          |

---

## Phase 0: Repo audit, setup, and image inventory

**Goal:** a clean, deployable Next.js baseline with every placeholder the later phases need.

1. **Audit the repo.** Report the Next.js version, router (app vs pages), TypeScript, Tailwind, package
   manager, and any existing pages. If the repo is empty or not yet a Next.js app, scaffold one:
   `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`.
   If it already exists, keep it and adapt; do not re-scaffold over existing work.
2. **Find and inventory the images.** Check `public/`, `public/images/`, `assets/`, and the repo root.
   Write `docs/IMAGE_INVENTORY.md` with a table: file, pixel size, file size, what it shows, and the section
   it suits (hero, about, services, gallery, logo, trust badge). Open each image to look at it; don't guess
   from filenames.
3. **Normalize the images** into `public/images/{hero,about,services,gallery,logos}/` with kebab-case names.
   Resize to at most 2400px on the long edge (hero) or 1600px (others), convert to WebP at about q80, and keep
   originals out of git (`/originals` in `.gitignore`). Flag anything under 1200px wide that is meant for
   the hero.
4. **Add tooling:** `zod`, `vitest`, `@playwright/test`, Prettier, and the scripts `typecheck`, `test`, `e2e`.
5. **Create the config skeleton** in `src/config/` (values from the proposal, each marked `// TODO(client)`):
   - `company.ts`: name, contact email (no phone), address, USDOT 4020917, MC-1516594, insurance wording,
     and only client-confirmed stats (`confirmedStats`).
   - `service-area.ts`: serviced states (placeholder: CA, NV, AZ, OR, WA, UT, ID, NM, CO, TX) and the home
     terminal (Corona, CA, lat 33.8753, lng -117.5664).
   - `routes.ts`: route corridors, each with `id`, `name`, `originStates[]`, `destStates[]`,
     `weeklyCapacity: 6`. Each direction is its own route (for example `west-to-tx` and `tx-to-west`).
   - `pricing.ts`: size classes and base rates (sedan $850, mid-size SUV $975, pickup/full-size SUV/van
     $1,100, oversized $1,300), inoperable +$150, modified +$100 with `modifiedPolicy: 'surcharge' | 'review'`,
     deposit `{ type: 'flat', amountCents: 10000 }` (percent is still supported). All money is stored as integer cents.
   - `booking.ts`: `timezone: 'America/Los_Angeles'`, `weekStartsOn: 1` (Monday), `leadDays: 3`,
     `weeksShown: 8`, `holdMinutes: 30`, personal-items notice text, terms version string.
6. **Create `.env.example`** with `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `BOOKINGS_EMAIL_TO`, `ADMIN_PASSWORD`,
   `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_GA_ID`.
7. **Create `docs/CLIENT_INPUTS.md`**, a checklist of everything still owed by 951 Express: logo files,
   final states and routes, rates, deposit, weekly capacity if not 6, Terms text, Stripe account, booking
   inbox, domain (purchased by the client), and confirmation of the trust stats.

**Done when:** `npm run build` passes, the Vercel preview deploys, and both inventories are committed.

> **Prompt:** Read CLAUDE.md and docs/BUILD_PLAN.md, then do Phase 0 only. Audit the repo, inventory and
> optimize the images I loaded, set up tooling, and create the config skeleton, .env.example, and
> CLIENT_INPUTS.md. Show me the image inventory before you assign images to sections.

---

## Phase 1: Design system + static landing page

**Goal:** the full landing page, matching proposal Figure 2, with real photography and no booking logic yet.

1. **Tailwind theme tokens** for the brand colors in CLAUDE.md. Load fonts with `next/font` (Inter for UI;
   a bold display weight for headlines).
2. **Components** in `src/components/ui/`: `Button` (primary accent orange, ghost), `Container`, `Section`,
   `SectionHeading`, `Card`, `Stat`.
3. **Sections** in `src/components/landing/`, composed in `src/app/page.tsx`:
   - `SiteHeader`: the logo; anchor links (About, Services, Service Area, Gallery, Contact); a
     "Get My Quote" button. Sticky, with a mobile menu.
   - `Hero`: kicker "Licensed & Insured Auto Transport", the headline, a subhead, the primary CTA, and a call
     link. Uses the best hero photo with a navy gradient overlay, `priority` on the image.
   - `TrustBar`: USDOT, MC number, and the confirmed licensing and cargo limit (only client-confirmed facts).
     Values come from `company.ts`.
   - `About`: company story and a fleet photo.
   - `Services`: open transport, dealer moves, personal vehicles, and any specialty services.
   - `ServiceAreaPlaceholder`: an anchor `#service-area`; the map arrives in Phase 2.
   - `Gallery`: responsive grid with a lightbox (keyboard accessible, Esc closes).
   - `ContactSection` and `SiteFooter` (address, email, /terms link, repeat CTA,
     copyright).
4. Every "Get My Quote" button calls a single `openBooking()` from a `BookingProvider` context. For now it
   opens an empty modal shell.
5. Copy lives in `src/content/landing.ts`, not inline in JSX.

**Done when:** the page looks right at 390px, 768px, and 1280px; Lighthouse mobile scores at least 90 for
performance and accessibility; there are no layout shifts from images.

> **Prompt:** Do Phase 1 of docs/BUILD_PLAN.md. Build the static landing page from the proposal mockup
> using the optimized images. Screenshot it at 390px and 1280px and show me before committing.

---

## Phase 2: Service-area map

**Goal:** an interactive U.S. map that always agrees with the booking qualification.

1. Install `d3-geo`, `topojson-client`, and `us-atlas`. Build `ServiceAreaMap` as a server-rendered SVG
   using `states-albers-10m.json`, so no projection runs on the client.
2. Drive it from `src/data/zips/coverage.json` (Phase 3A): per-region state ZIP counts plus lat/lng points
   (`[lat, lng, zipCount]` per 0.25° cell). Never import `west.json` or `east.json`. Fill states that have West
   coverage in navy and East coverage in a second brand blue (legend: "West pickup/delivery", "East
   pickup/delivery"), others `#E4E8EE`, with white borders. Plot the coverage points as small dots so partly covered
   states (for example Texas for El Paso, or the Georgia blocks) read honestly. Mark the Corona terminal with a pin.
3. A small client wrapper adds a hover/focus tooltip (state name, region, and "We service part of this state" or
   "Not currently serviced") and keyboard focus on states (`role="img"` with `aria-label` on the SVG, and a
   visually hidden list of covered states for screen readers).
4. Add a legend and a "Check My Route" button that opens the booking modal.
5. Test that every state in `coverage.json` is drawn as covered, and that no state outside it is.

**Done when:** the map renders with JS disabled, the tooltip works with mouse and keyboard, and the test passes.

> **Prompt:** Do Phase 2 of docs/BUILD_PLAN.md: the service-area map section.

---

## Phase 3A: Booking rules (pure functions, fully tested)

**Status:** done. The client's rules replaced the placeholder routes and pricing.

- **ZIP data:** raw client files live in `data/raw/`. `scripts/build-zip-data.mjs` normalizes to 5-digit strings,
  removes duplicates, checks each ZIP with the `zipcodes` package, refuses to write if a ZIP is in both lists, and
  writes `src/data/zips/{west,east,coverage}.json`. The full lists are server-only.
- **Routing** (`src/lib/routing.ts`, `routing.server.ts`): two regions defined by the lists; a shipment must cross
  regions. `resolveRoute` returns `{ ok: true, route, pickupRegion, deliveryRegion }` or `ok: false` with
  `invalid_zip | pickup_not_served | delivery_not_served | same_region`. `resolvePickup` drives the "Shipping
  West → East" label and restricts the delivery ZIP to the opposite list. Routes: `west-to-east`, `east-to-west`,
  6 per week each.
- **Pricing** (`src/lib/pricing.ts`, `src/config/pricing.ts`): seven classes from $1,400 to $1,900; large vehicles
  return `{ quoteRequired: true }`. Top Deck Load +$150. Deposit: a flat $100 (changed 2026-10-13 from 25%). (Changed 2026-10-13: inoperable and modified vehicles are no longer priced online; they go to a personalized quote.)
- **Vehicle classes** (`src/lib/size-class.ts`, `src/config/vehicle-classes.ts`): longest-prefix model lists plus
  year rules for Ranger, Tacoma, and Frontier. Unknown returns `null`; `resolveSizeClass` is the server decision
  and never lets a customer pick a cheaper class than the table assigns.
- **Quote-required path:** `quoteRequestSchema` in `src/lib/schemas.ts`. The lead is stored in Phase 4 (`leads`
  table) and emailed in Phase 7.
- Vitest with a 95% coverage gate on `src/lib`.

---

## Phase 3B: Remaining business logic

**Status:** done.

1. **Vehicle lookup (removed 2026-10-13):** this phase built NHTSA vPIC helpers (`src/lib/vehicles.ts`) and the
   `/api/vehicles/makes` and `/api/vehicles/models` routes for the old make and model dropdowns. Cal chose plain typed
   fields instead, so nothing called them and they were deleted, along with the live smoke test. Vehicle year limits
   (1950 to next year) stay in `src/config/vehicles.ts`; typed text is normalized by `src/lib/vehicle-normalize.ts`.
2. **`weeks.ts`:** `bookableWeeks(now)` returns the next `weeksShown` Monday-start weeks in
   America/Los_Angeles, skipping any week that starts less than `leadDays` calendar days from now (exactly
   `leadDays` away is allowed). Labels look like "Oct 19 – 25", "Oct 26 – Nov 1", and "Dec 28 – Jan 3".
   `findBookableWeek` is the server check for a week sent by the browser, and `weekNumber(weekStart)` is the
   integer key for the Phase 4 advisory lock. Built on `date-fns` + `@date-fns/tz`.
3. **`schemas.ts`:** `step1Schema` (includes `topDeck`, the optional `selectedClass`, and terms), `step3Schema`,
   `quoteRequestSchema` (the large-vehicle lead, with `topDeck`), and `adminActionSchema`. Shared by client and
   server. Prices and totals are never accepted from the browser.
4. **Tests** cover DST (spring forward and fall back), month and year boundaries, the lead-day edge, and the
   Los Angeles calendar versus UTC. `src/lib` stays above the 95% coverage gate.

---

## Phase 4: Database + race-safe capacity

**Status:** done and verified on the Neon `dev` branch: migration applied, seed run twice with no changes, and the
13-hold concurrency test passed 10 times in a row.

**Goal:** persistent bookings, with a hold system that can never sell spot 13.

1. Provision Neon Postgres from the Vercel Marketplace, connected to the project so `DATABASE_URL` is set for
   Preview and Production. Use a separate Neon branch for local dev and Preview.
2. **Drizzle schema** (`src/db/schema.ts`):
   - `routes` (id, slug, name, pickup_region, delivery_region, weekly_capacity int default 6,
     active bool), seeded from `routes.ts` (`west-to-east`, `east-to-west`).
   - `leads` (id, created_at, route_id, pickup_zip, delivery_zip, vehicle jsonb, operable, modified, top_deck,
     name, phone, email, notes, status `new|contacted|closed`) for the quote-required (large vehicle) form.
   - `week_overrides` (route_id, week_start date, capacity_override int null, closed bool), with a primary
     key of (route_id, week_start).
   - `bookings` (id uuid, public_token text unique, status enum `held|paid|completed|cancelled|expired`,
     route_id, week_start date, pickup_zip, delivery_zip, pickup_region, delivery_region, vehicle jsonb,
     operable bool, modified bool, top_deck bool, personal_items bool, size_class,
     size_class_source `table|customer`, total_cents, deposit_cents, balance_cents, needs_review bool, terms_version,
     terms_accepted_at, stripe_session_id unique, stripe_payment_intent, payer_email, hold_expires_at,
     customer jsonb null, pickup_address jsonb null, delivery_address jsonb null, notes text, created_at,
     paid_at, details_submitted_at, cancelled_at).
   - `rates` and `settings` tables (seeded from `pricing.ts`) so the admin can edit prices later.
   - Indexes on (route_id, week_start, status) and (status, hold_expires_at).
3. **`src/server/capacity.ts`:**
   - `spotsTaken(routeId, weekStart)` counts `paid` + `completed` bookings, plus `held` bookings whose
     `hold_expires_at > now()`.
   - `createHold(input)` runs in one transaction: take `pg_advisory_xact_lock(routeIdInt, weekStartInt)`,
     read capacity (the override, else the route's capacity; a closed week counts as 0), count spots taken,
     then insert a `held` booking with `hold_expires_at = now() + holdMinutes`. If the week is full, it
     returns `{ full: true, nextAvailableWeek }`.
   - `getAvailability(routeId)` returns each bookable week with `{ capacity, taken, remaining, closed }`.
4. A Vercel Cron job (`vercel.json`, daily because the Hobby plan allows nothing more frequent; every 15 min on Pro) hitting `/api/cron/expire-holds`, protected by
   `CRON_SECRET`, marks stale holds `expired`. The counting query ignores stale holds anyway, so the cron
   job is only cleanup.
5. **Concurrency test** (`src/server/capacity.concurrency.test.ts`, runs only with `TEST_DATABASE_URL` set to a dev branch): fire 13 `createHold` calls in parallel against a test database for one route
   and week. Exactly 6 succeed and 1 returns `full` (7 simultaneous holds).

**Done when:** migrations run on Preview, the seed is idempotent, and the concurrency test passes ten times
in a row.

> **Prompt:** Do Phase 4 of docs/BUILD_PLAN.md. Set up Neon + Drizzle, the schema, seed data, and race-safe
> holds. Run the 13-booking concurrency test ten times and show me the results.

---

## Phase 5: Booking modal, Step 1 (Qualify & Quote)

**Status:** built, awaiting approval. Playwright (`npm run e2e`, against the Neon dev branch) covers both directions,
same-region and unserved ZIPs, unknown vehicles, the lead path, a full week, top deck, and axe on every state.
The Step 2 summary is a placeholder: its payment button stays disabled until Phase 6.

**Goal:** proposal Figure 4, working end to end up to "See My Price & Deposit".

1. **Modal shell:** an accessible dialog (focus trap, Esc to close with a confirm prompt if partly filled,
   scroll lock). Full-screen on mobile, centered at 520px wide on desktop. A three-segment progress bar
   labeled "Vehicle & Route", "Deposit", "Your Details". Form state lives in a `useReducer`, persisted to
   `sessionStorage` so a refresh doesn't lose answers.
2. **Fields, in this order:**
   1. Pickup ZIP + Delivery ZIP. The ZIP lists are server-only, so call `POST /api/qualify` (pickup on blur, then
      both). When the pickup ZIP resolves, show "Shipping West → East" (or East → West); the delivery ZIP then
      accepts only the opposite region. Same-region and not-served failures use the copy in
      `src/config/routes.ts`, and a not-served failure adds an email link (no phone number anywhere). Every later field stays
      disabled until the route resolves.
   2. (Replaced 2026-10-13: Year, Make, and Model are now three plain typed fields with no dropdowns; see Batch 4 in
      docs/CAL_CHANGES_2026-10-13.md.) Originally: dependent dropdowns (the removed `/api/vehicles/*` routes), with type-to-search on the long lists. Once all three are set,
      show the size class chip. If the vehicle isn't classified, show class cards with the example vehicles, and
      the booking gets `needsReview: true`. The server re-classifies and never accepts a cheaper class.
      A large vehicle swaps the price button for a "Request a personalized quote" form (name, phone, email,
      ZIPs, vehicle, operable/modified, notes) that stores a lead: no deposit, no spot hold.
   3. "Is the vehicle operable?" (Yes, it runs and drives / No) and "Has it been modified in any way?"
      (Yes / No, factory stock), as radio pills.
      3b. "Standard or Top Deck Load (+$150)?" radio, with the two benefits from `topDeck.benefits` shown with the
      option.
   4. "Any personal items in the vehicle?" (Yes / No). Yes reveals the accent-tinted callout:
      **"100 lbs included. Anything over 100 lbs is at the driver's discretion."**
   5. "Estimated pickup week · West → East". Load from `GET /api/availability?route=`. Each week row shows a
      fill bar and "N spots left". Full or closed weeks are struck through, red, `aria-disabled`, labeled
      "FULL 6/6", and cannot be selected.
   6. A checkbox, "I agree to the Terms and Conditions", where the link opens `/terms` in a new tab.
3. The **"See My Price & Deposit →"** button stays disabled until every field is valid and terms are checked.
   On click, it calls `POST /api/quote`, which validates and recomputes on the server, and moves to Step 2.
4. Track analytics events for each step: `quote_started`, `route_qualified`, `route_rejected`,
   `quote_viewed`.

**Done when:** a Playwright test completes Step 1 for an in-area route, an out-of-area zip blocks the flow,
a full week can't be picked, and the modal passes axe checks.

> **Prompt:** Do Phase 5 of docs/BUILD_PLAN.md: the Step 1 booking modal and the qualify, vehicle, quote,
> and availability APIs. Show me screenshots of the modal at 390px and 1280px.

---

## Phase 6: Step 2 (cart + Stripe deposit)

**Status:** approved and deployed. Notes from the build:

- The current Stripe API (the SDK's default) renamed `ui_mode: 'embedded'` to `'embedded_page'`. Same inline checkout.
- Stripe requires a session to live at least 30 minutes, so the session expires 30:10 out and the hold is extended
  to match (`sessionExpiry` in `src/lib/checkout-session.ts`).
- **Tall-modal payment stall (cap kept).** In our modal, Pay can silently stall: no error, no `payment_methods`
  request, booking stays `held`. It is deterministic by geometry: with a 1000px-high window, a 820px modal pays and a
  835px modal stalls; with a 900px window, 835px pays; with a 1200px window, 820px stalls. In practice it tracks where
  the bottom edge of Stripe's iframe sits in the window (about 830px from the top and below stalls). At the stall, Stripe
  asks its invisible hCaptcha for a challenge (`getcaptcha`) that never resolves, the captcha's frames sit offscreen
  (y about -9153), and Stripe's overlay frame stays hidden. The payment step is therefore capped at 700px high
  (`BookingModal.tsx`), and `npm run e2e:stripe` pays at 390x844 (and declines at 1280x900) through the real embedded checkout to guard it.
  Ruled out, each with a test (30-minute investigation, Oct 10):
  - Native modal top layer, the inert backdrop, and our focus handling: a non-modal dialog stalls identically.
  - Our dialog painting over Stripe's body-level helper frames: stacking the dialog beneath them still stalls.
  - Scroll lock, the sticky header, `scroll-behavior: smooth`, scroll padding, focus outlines: toggling each changes nothing.
  - The Pay button being clipped, covered, or scrolled out of view: it is fully visible and the hit test lands on Stripe's iframe.
  - `@stripe/react-stripe-js`: mounting with the raw `createEmbeddedCheckoutPage` stalls identically.
  - Automation signals: human-like mouse movement changes nothing.
  - A dialog, a scrolling box with a sticky header, a long page behind it, and a cart above the form, rebuilt on a bare page
    with the same geometry (iframe bottom at 860 to 912px): all pay. So the cause is something else on our page, not
    yet found. Next step: pay on real phones (Phase 10), and if it shows up there, send Stripe support the repro.
    The stall also shows up as an occasional flake in automated runs after many test payments from one machine (a few
    failures in dozens of runs, never in the same test twice), so `npm run e2e:stripe` retries a failed test once.
- `npm run e2e:stripe` runs the Stripe suite in two parts. `@stripe-api` tests (`e2e/stripe-api.spec.ts`) never open Stripe's
  iframe: they make holds through our own endpoints and send webhook events signed with the webhook secret (paid, replay,
  expired, tampered signature, release, status backstop, full week). They are stable and are the gate
  (`npm run e2e:stripe:api` runs only these, with no Stripe CLI). `@stripe-ui` tests (`e2e/payment.spec.ts`) are the only
  ones that pay through the real embedded checkout: one success at 390x844 (cart, payment, Step 3, confirmation) and one
  decline at 1280x900. They run one after the other with one retry, because Stripe's invisible captcha sometimes stalls in
  automated browsers. Do not scan the page with axe while Stripe's frame is live: it makes the stall more frequent.
- Link's "Save my information" is ticked by default and then asks for a phone number. Consider turning Link off in
  the Stripe Dashboard payment methods if the client prefers a shorter form.

**Goal:** proposal Figure 6 (left). The customer pays the deposit inside the modal, and the spot is held
while they pay.

1. `POST /api/checkout`: validate the Step 1 payload, recompute the quote, then call `createHold`. If the
   week is full, return 409 with `nextAvailableWeek`, and the UI tells the customer the week just filled and
   offers the next one. Otherwise create a Stripe Checkout Session with `ui_mode: 'embedded'`,
   `redirect_on_completion: 'never'`, `mode: 'payment'`, one line item ("Transport deposit: 2021 Toyota
   RAV4, West → East, week of Oct 19") for `depositCents`, `expires_at` set to the hold expiry (Stripe's minimum
   is 30 min), `metadata.bookingId`, and `customer_creation: 'if_required'`. Save `stripe_session_id` and
   return `clientSecret` + `bookingId` + `publicToken`.
2. **Cart UI:** a vehicle summary card, then route, pickup week, personal items, transport total, balance
   due at delivery, and a bold "Deposit due today" line in green. Below that, `EmbeddedCheckoutProvider` +
   `EmbeddedCheckout`, a "Secure checkout · processed by Stripe" note, and a hold countdown
   ("Your spot is held for 29:12").
3. `POST /api/stripe/webhook` (Node runtime, raw body, signature verified):
   - `checkout.session.completed` with `payment_status: 'paid'` marks the booking `paid` and stores
     `paid_at`, `payment_intent`, and `payer_email`. It also emails the customer a "Deposit received. Finish
     your booking details" link (`/booking/{publicToken}`) in case they close the modal.
   - `checkout.session.expired` marks a `held` booking `expired`.
   - Make both idempotent: only update when the status transition is valid.
4. The embedded checkout `onComplete` handler calls `GET /api/bookings/{token}/status`, which retrieves the
   session from Stripe as a backstop if the webhook hasn't landed yet. Once the booking is paid, move to Step 3.

**Done when:** test card 4242 pays and advances to Step 3; card 4000 0000 0000 0002 declines and keeps the
hold; abandoning checkout frees the spot after expiry; replaying a webhook changes nothing.

> **Prompt:** Do Phase 6 of docs/BUILD_PLAN.md: the Step 2 cart, Stripe Embedded Checkout, and webhooks.
> Use Stripe test mode and the Stripe CLI, and show me the paid, declined, and expired cases.

---

## Phase 7: Step 3 details + Step 4 emails

**Status:** approved. Notes from the build:

- Step 3 is one shared form (`DetailsForm`) used in the modal and on `/booking/[token]`. Pickup and delivery ZIPs start
  as the quoted ZIPs; the customer may refine them, but each must stay in the quoted region (checked live, and again on
  the server). Editing a field clears its error.
- `POST /api/bookings/{token}/details` completes a `paid` booking once: the status change itself is the guard, so two
  simultaneous submits cannot both win.
- Emails use React Email with hand-built plain-text versions. They are sent after the response (`after()`), one at a
  time (Resend allows 2 requests a second), and the result is recorded on the row (`team_email_sent_at`,
  `customer_email_sent_at`, `email_error`; leads have `email_sent_at`, `email_error`). A failed email never undoes a booking.
- Sending domain: `notify.951express.com` is verified in Resend (`EMAIL_FROM=951 Express Bookings <bookings@notify.951express.com>`).
  The dispatcher inbox is `BOOKINGS_EMAIL_TO` (951.dispatcher@gmail.com). Reply-To on the deposit email and the
  booking confirmation is that inbox (`src/config/email.ts`), because the From address is not monitored.
- `npm run e2e:email` sends the four real emails (deposit received, new booking, confirmation, new lead) and asks Resend
  for each one's delivery status. Customer side is `E2E_EMAIL_CUSTOMER` in `.env.local` (not committed).
- `/booking/*` is `noindex` in the page metadata and in an `X-Robots-Tag` header.
- `npm run email:preview` renders the emails to `.email-preview/`. `npm run e2e:email` sends real emails (3 per run).

**Goal:** proposal Figure 6 (right) and Figure 7.

1. **Step 3 form**, shown only when the booking is `paid`. A green banner reads "✓ Deposit received. Your spot
   for Oct 19 – 25 is reserved." Fields: first name, last name, phone, email (prefilled from Stripe), your
   address, pickup address (with a "Same as my address" toggle), delivery address, and notes for the driver.
   The pickup and delivery zips are locked to the qualified zips; if the customer edits them, re-run
   qualification and block on a mismatch. Use the address autocomplete from Google Places only if the
   client provides a key; plain structured fields are the default.
2. `POST /api/bookings/{token}/details` validates the form with zod, saves it, and sets status `completed` and
   `details_submitted_at`. It rejects the request if the booking isn't `paid` or details were already
   submitted.
3. **Emails** with React Email templates in `src/emails/`, sent through Resend:
   - `NewBookingEmail` to `BOOKINGS_EMAIL_TO`. Subject: "New Booking: {year make model} · {route} · Week of
     {date} · Deposit Paid". Sections: Customer, Shipment (pickup, delivery, week with "spot N of 6",
     vehicle, size, operable, modified, personal items), Payment (total, deposit paid, balance due, terms
     accepted with timestamp and version), and a link to the booking in /admin. If `needs_review` is set, add
     a "Review needed" banner (unknown vehicle size, or a payment that arrived after the hold expired).
   - `CustomerConfirmationEmail`: receipt, what happens next, the balance due at delivery, the personal-items
     policy, and contact info.
4. The `/booking/[token]` fallback page renders Step 3 outside the modal for customers coming from the email
   link, and a confirmation once it's done.
5. Show a confirmation screen in the modal ("You're booked!") with a summary.

**Done when:** a full test booking delivers both emails with correct data, as confirmed in the Resend
dashboard; submitting details twice is rejected; the fallback link works.

> **Prompt:** Do Phase 7 of docs/BUILD_PLAN.md: the Step 3 details form, the booking emails, and the
> fallback booking page. Send test emails to me and show me the rendered templates.

---

## Phase 8: Terms page + admin view

1. **`/terms`:** a clean, readable legal page rendered from `src/content/terms.ts` (done; see the content update). Until the client sends
   final text, use a clearly marked placeholder. Show the terms version and "Last updated" date; the version
   is stored with every booking.
2. **`/admin`:** protected by middleware HTTP Basic Auth (`ADMIN_PASSWORD`) and set to `noindex`.
   - **Bookings:** a table filterable by status, route, and week, with a detail drawer showing all fields and
     a link to the Stripe payment. Flags "paid, details pending" bookings.
   - **Capacity grid:** routes × the next 8 weeks, each cell showing taken/capacity. Actions: close or reopen
     a week, set a capacity override, and cancel a booking to release its spot. Cancelling does not refund in
     Stripe; refunds are done in the Stripe dashboard, as the proposal scopes it.
   - **Rates:** edit base rates, the Top Deck surcharge, and the deposit setting (flat amount or percent; stored as the `deposit` settings row, seeded flat $100), stored in the DB tables from
     Phase 4. Quotes read from the DB, with config as the fallback. There is no inoperable or modified surcharge
     any more (those vehicles get a personalized quote), so the editor must not include them.
   - **Weeks grid:** show top-deck usage per route and week (SUV slots and the car slot, taken and left) and allow a
     per-week override. The columns `week_overrides.top_deck_suv_override` and `top_deck_car_override` already exist
     and the capacity code honors them.
   - **Address review:** the booking detail shows `address_flags` (a city the customer confirmed even though it does not
   - **Dispatch sheet:** a "Download dispatch sheet" button on the booking detail, backed by `GET /api/admin/bookings/[id]/dispatch.pdf` (admin session required). Reuse `renderDispatchPdf` in `src/server/dispatch-pdf.ts`; it needs no changes. The booking detail also shows the optional vehicle color, VIN and the pickup and delivery contacts. For now the email attachment is the only way Cal gets the PDF.
     match its ZIP) next to the review reason "city/ZIP mismatch", the derived state, and the region of each address.
   - **Vehicles:** the booking detail, the leads list and the dispatch sheet show both what the customer typed
     (`vehicle_typed`) and the normalized vehicle, and the review reason (`review_reason`, for example
     "vehicle not recognized: 'zzz thing'").
   - **Leads:** a list of quote requests with their `quote_reasons` (large vehicle, inoperable, modified,
     exotic, high value) and `modification_details`, filterable by reason, with the lead status.
   - **Config values are defaults only; the database is the source of truth once seeded.** The seed
     (`src/server/seed.ts`) only inserts rows that are missing and never updates an existing one, so a value the
     client edits (route capacity, rates, deposit, surcharges) survives every deploy. Changing an existing value
     for everyone ships as a one-time data migration in `drizzle/` (see `0005_data_capacity_and_deposit.sql`).
     The editors must write to the DB, and quotes, holds and capacity must read from it, with config only as the
     fallback for a missing row. A seed test (`src/server/seed.db.test.ts`) guards this.
   - Log every admin action (who/what/when) to an `admin_log` table.

**Done when:** closing a week makes it show unavailable in the modal right away, cancelling frees the spot,
and a rate change shows up in the next quote.

> **Prompt:** Do Phase 8 of docs/BUILD_PLAN.md: the Terms page and the password-protected admin view.

---

## Phase 9: SEO, analytics, accessibility, performance

1. **Metadata:** title, description, canonical, Open Graph and Twitter tags, and an OG image generated with
   `next/og` in the brand style.
2. **JSON-LD:** `MovingCompany` (or `LocalBusiness`) with name, address, phone, `areaServed` from the covered
   states in `coverage.json`, and `url`. Add an `FAQPage` only if a FAQ section exists.
3. `sitemap.ts` and `robots.ts`, with /admin and /booking disallowed.
4. Vercel Analytics, plus GA4 through `@next/third-parties` if `NEXT_PUBLIC_GA_ID` is set, with the funnel
   events from Phase 5 and a `deposit_paid` conversion fired once from the confirmation state.
5. Run an axe audit and fix everything: color contrast (accent buttons use navy text, never white), focus rings, labels,
   error messages linked with `aria-describedby`, reduced-motion support.
6. Performance: hero LCP under 2.5s on mobile 4G, and the booking modal JS loaded with `next/dynamic` only
   when opened.

**Done when:** Lighthouse mobile is at least 90 in all four categories and the structured data passes
Google's Rich Results Test.

> **Prompt:** Do Phase 9 of docs/BUILD_PLAN.md: SEO, analytics, accessibility, and performance passes,
> with Lighthouse results before and after.

---

## Phase 10: End-to-end QA + launch

1. **Playwright e2e suite** on the Vercel Preview URL: happy path, out-of-area zip, unclassified vehicle,
   inoperable and modified pricing, personal-items notice, full week, a hold expiring mid-checkout, a declined
   card, closing the modal after payment and finishing from the email link, and the admin
   close-week/cancel/rate-change actions.
2. Manual check on a real iPhone and Android device (pay a real test-mode deposit on each: the Stripe checkout stalled in tall automated windows, see Phase 6, so confirm it never happens on a phone), plus Safari, Chrome, and Firefox on desktop.
3. **Launch checklist** (record each item in `docs/LAUNCH.md`):
   - [ ] The client purchases the domain (not included in the fee) and it's added to Vercel with DNS verified
   - [ ] Resend sending domain verified (SPF/DKIM), `EMAIL_FROM` updated, test email lands in the inbox, not spam
   - [ ] Stripe account activated in the client's name; live keys set in Vercel Production only
   - [ ] Live webhook endpoint created for `https://<domain>/api/stripe/webhook` and `STRIPE_WEBHOOK_SECRET` updated
   - [ ] Production DB migrated and seeded with the final routes, rates, and deposit from CLIENT_INPUTS.md
   - [ ] All `TODO(client)` values resolved (`grep -r "TODO(client)" src` returns nothing)
   - [ ] Final Terms text published; terms version bumped
   - [ ] One real $1 test booking in live mode, then refunded and cancelled in admin
   - [ ] `ADMIN_PASSWORD` shared with the client securely; admin walkthrough done
4. Start the 30-day post-launch support window. Log issues in GitHub Issues.

> **Prompt:** Do Phase 10 of docs/BUILD_PLAN.md: run the full e2e suite on Preview, fix failures, and
> walk me through the launch checklist item by item.
