# Open Questions and Inputs for 951 Express (Cal)

Every placeholder in code is marked `TODO(client)`. Tick an item when Cal answers it, then make the change named in it.
Items are grouped as: decisions, content and files, accounts and launch.

## 1. Decisions

### Quotes and pricing

- [ ] **Full-size vans** (Transit, Sprinter, Express, Savana, ProMaster): personalized quote (current) or an online price? (`src/config/eligibility.ts`)
- [ ] **Exotic list** (Ferrari, Lamborghini, McLaren, Rolls-Royce, Bentley, Aston Martin, Bugatti, Pagani, Koenigsegg, Maserati, Lotus, any Maybach): keep Maserati and Lotus?
- [ ] **High value:** is $100,000 the right line for "personalized quote"? (`highValueThresholdUsd`)
- [ ] **Sedan and SUV class lists:** confirm them and the pickup year cutoffs. Ranger 2013–2018 is not classified (not sold in the U.S. those years), so the customer picks a class.
- [ ] **Delivery estimate:** confirm "7–10 days after pickup" (`deliveryWindowDays`). The dispatch sheet shows the first day of the pickup week + 7 to the last day + 10 (for example Oct 26 – Nov 4).

### Top Deck Load limits (defaults in `topDeckLimits`, `src/config/pricing.ts`)

- [ ] Is it 3 SUVs **and** 1 car on top at the same time, per route per week, on top of the 6 main spots?
- [ ] Are minivans and small and midsize pickups allowed on top (current: yes, as SUV slots)?
- [ ] May a sedan use a free SUV slot when the car slot is taken (current: yes)?

### Service area

- [ ] **East list gaps:** Charlotte (280–282), Birmingham (350–352), all of Florida, and the Northeast above Delaware are outside East. Intentional? (Atlanta metro 30001–30400 was added 2026-10-13.)
- [ ] **Yuma, AZ** (85336, 85349, 85350, 85364–85367, 85369) is West for both pickup and delivery. Is Yuma pickup-only?

### Addresses and the dispatch sheet

- [ ] **Street-address verification** (Smarty or Google Address Validation, a small per-lookup cost): yes or no? Today we check state and city against the ZIP only.
- [ ] **Carrier address** printed on the dispatch sheet: `2108 Collett Ave Apt 204, Corona, CA 92879` (from Cal's own sheet). Confirm. (`company.dispatchAddress`, used only on the sheet.)
- [ ] **VIN check:** a VIN is accepted when it has 17 letters and numbers, no I, O or Q. Add the check-digit test too? (Older and imported vehicles often fail it.)
- [ ] **Lot #** is left blank on the dispatch sheet for Cal's dispatch system. Right?

### Payments and legal

- [ ] **Link and extra payment methods** ("Save my information with Link", Bank, Klarna): keep or switch off? They are Stripe Dashboard settings.
- [ ] **Terms:** a standard draft. Confirm the `TODO(client)` items in `src/content/terms.ts` (cancellation window, refund timing, claim deadline, packing rules, governing venue) and have an attorney review it before live deposits.

## 2. Content and files

- [ ] **Hero photo:** the black-and-white truck is only 1500px wide (we did not enlarge it). A larger original (2400px or wider) would be sharper.
- [ ] **Team, office and terminal photos:** none supplied; About uses the fleet photo only.
- [ ] **More gallery photos:** we have six. Original files, not screenshots or messaging-app copies.
- [ ] **Permission to publish the photos**, including the blurred license plates.
- [ ] **Logo:** a clean transparent PNG or SVG would be sharper than the cut-out we made. Drop it at `originals/951-express-logo.png` and run `node scripts/optimize-images.mjs`.
- [ ] **Public contact:** the site shows `951.dispatcher@gmail.com` and no phone number. Confirm, and send a street address if it should appear on the site.
- [ ] **Customer confirmation wording** ("What happens next", `src/content/emails.ts`): review it.
- [ ] **Company stats** (years in business, and so on): only added to the trust bar after Cal confirms them (`company.confirmedStats`).

## 3. Accounts and launch

- [ ] **Stripe** account activated in the client's name. Live keys go in Vercel Production only (Preview and Development keep test keys).
- [ ] **Stripe webhook** endpoint per environment (`/api/stripe/webhook`; events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`), each with its own `STRIPE_WEBHOOK_SECRET`. Pin it to the API version in `src/config/stripe.ts`.
- [ ] **Domain** bought by the client, plus DNS access; then set `NEXT_PUBLIC_SITE_URL`.
- [ ] **Email sending:** `notify.951express.com` is verified in Resend. Move `EMAIL_FROM` to the final domain if it changes.
- [ ] **Booking inbox** (`BOOKINGS_EMAIL_TO`): currently 951.dispatcher@gmail.com; add more addresses (comma separated) if wanted.
- [ ] **Google Analytics 4** measurement ID, if they want GA.
- [ ] **Real-device check:** pay a test-mode deposit on a real iPhone and Android phone (Stripe's checkout can stall in automated browsers).
- [ ] **Production data:** confirm the production database has the final routes, rates and the $100 deposit; client edits made in the admin (Phase 8) survive deploys.

## Go-live checklist (Stripe live mode)

Do these in order, on a quiet day, with Antonio. Live keys go in **Vercel Production only**; Preview and Development keep
test keys. Never paste a key into chat, a commit, or a screenshot.

**The three Stripe variables** (names from `.env.example`). Production changes all three. (The Stripe API version is not an env
var: it is pinned in `src/config/stripe.ts`.)

| Variable                             | Test now                           | Live value                                    | Changes for live? |
| ------------------------------------ | ---------------------------------- | --------------------------------------------- | ----------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...`                      | `pk_live_...`                                 | Yes               |
| `STRIPE_SECRET_KEY`                  | `sk_test_...`                      | `sk_live_...` (or a restricted `rk_live_...`) | Yes               |
| `STRIPE_WEBHOOK_SECRET`              | `whsec_...` from the test endpoint | `whsec_...` from the new live endpoint        | Yes               |

Everything else (`DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BOOKINGS_EMAIL_TO`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`,
and so on) stays as it is. The publishable and secret keys must match: if they are from different modes, `/api/checkout`
answers 503 ("Online booking is temporarily unavailable") and logs `[checkout] Stripe keys are from different modes`.

1. [ ] **Account ready:** the Stripe account is activated in Cal's name (business details, bank account for payouts).
2. [ ] **Clean the test data first** (optional but recommended): run `scripts/sql/prod-inventory.sql` in the Neon SQL editor
       on the main branch, review it, then `scripts/sql/prod-cleanup-test-data.sql` (it rolls back until you change the last
       line to `COMMIT`). This frees test holds so they do not take real spots. Do it before switching keys, because after the
       switch the app can no longer expire a test session.
3. [ ] **Live API keys:** in the Stripe Dashboard, switch to live mode and copy the publishable key and create or reveal the
       secret (a restricted key with Checkout Sessions write and PaymentIntents read is better than the full secret).
4. [ ] **Live webhook:** Dashboard (live mode) → Developers → Webhooks → add endpoint `https://951express.com/api/stripe/webhook`,
       events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, API
       version pinned to the one in `src/config/stripe.ts`. Copy its signing secret (`whsec_...`).
5. [ ] **Payment-method domain:** Dashboard (live mode) → Settings → Payment method domains → add `951express.com` and
       confirm it verifies, so Apple Pay and Google Pay appear in Embedded Checkout. Check that cards are enabled in the live
       payment method settings.
6. [ ] **Set the three variables in Vercel Production only** (Settings → Environment Variables, scope: Production). Do not
       touch Preview or Development.
7. [ ] **Redeploy Production.** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is baked in at build time, so changing it without a
       new build leaves the browser on the old key. Redeploy from the Vercel dashboard (without the build cache) or push a commit.
8. [ ] **Real-card test:** on https://951express.com book a real route with a real card you own (the flat $100 deposit).
       Check: checkout opens with no mode error, the payment succeeds, the details step opens, the team email arrives with
       the dispatch sheet, the customer email arrives, and the booking shows as paid in the database. In the Stripe Dashboard
       (live mode) confirm the payment and that the webhook endpoint shows delivered events with 200 responses.
9. [ ] **Refund the test payment:** Dashboard (live mode) → Payments → the $100 payment → Refund. The app has no refund
       button (refunds are done in Stripe). Then free the spot: cancel or delete that test booking so it does not take one of
       the 6 weekly spots (ask Antonio; until the Phase 8 admin exists this is a database change).
10. [ ] **Watch the first real booking:** check the webhook deliveries and both emails, and keep the test keys in Preview so
        later changes can still be tested safely.

Rollback: put the three test values back in Production and redeploy. Bookings already paid with live cards stay valid.

## Done (for the record)

- [x] Logo, accent color (#F06A1A), ZIP lists, base rates, USDOT 4020917 and MC-1516594 wording received.
- [x] Deposit is a flat $100 and the balance is Cash, Cashier's Check, or Zelle only (2026-10-13).
- [x] Weekly capacity is 6 per direction (2026-10-13).
- [x] Inoperable and modified vehicles go to a personalized quote (2026-10-13).
- [x] Dispatcher inbox and Resend sending domain set up.
