# Client Inputs Still Owed by 951 Express

Check items off as they arrive. Every placeholder in code is marked `TODO(client)`.

## Brand and photography

- [x] Logo received (JPEG on a black background; the black was cut out to make a transparent version). A clean transparent PNG or SVG from the client would be sharper: drop it at `originals/951-express-logo.png` and run `node scripts/optimize-images.mjs`.
- [x] Accent color: the logo orange #F06A1A (approved), with navy text on it.
- [ ] **Hero:** only one supplied photo is at least 2000px wide (the red truck profile on gravel). Ask for a higher-resolution, carrier-in-frame hero shot if they want a stronger option.
- [ ] **Team / office / terminal photos:** none supplied. The About section uses the fleet photo only.
- [ ] More gallery photos (we have 2). Original files, not screenshots or messaging-app copies.
- [ ] Approval to publish the photos, including the blurred license plates.

## Business details

- [x] ZIP lists and direction rules (West ↔ East only), received. Confirm the East list is final: it is built from whole 3-digit ZIP blocks. Atlanta metro (30001–30400) was added on 2026-10-13 via `data/raw/east_additions.txt`. Charlotte (280-282), Birmingham (350-352), all of Florida, and the Northeast above Delaware are still outside the East list.
- [x] Base rates per size class, received.
- [x] Inoperable and modified vehicles no longer get an online price: they go to a personalized quote (Cal, 2026-10-13). The old +$150 and +$100 surcharges are retired.
- [x] Deposit is a flat $100 on every booking (Cal, 2026-10-13). The balance is paid at delivery by Cash, Cashier's Check, or Zelle only; no credit cards.
- [ ] Confirm the standard delivery estimate of 7–10 days after pickup (`deliveryWindowDays` in `src/config/booking.ts`).
- [x] Inoperable vehicles no longer book online (personalized quote), so the top-deck question for them is moot.
- [ ] **Top-deck limits** (defaults in `topDeckLimits`, `src/config/pricing.ts`): 3 SUV slots and 1 car slot per route per week, held together with the 6 main spots. Confirm: is it 3 SUVs **and** 1 car at the same time? Are minivans and small/midsize pickups allowed on top (default: yes, as SUV slots)? May a sedan use a free SUV slot when the car slot is taken (default: yes)?
- [ ] Confirm the sedan and SUV class lists and the pickup year cutoffs (Ranger 2013-2018 is unclassified: those years were not sold in the U.S., so the customer picks).
- [ ] Should full-size vans (Transit, Sprinter, Express, Savana, ProMaster) be quote-required? Savana was added as the Express twin.
- [x] Weekly capacity is 6 per direction per week (Cal, 2026-10-13).
- [x] Public contact email: 951.dispatcher@gmail.com (the site shows no phone number). [ ] Street address.
- [x] USDOT 4020917, MC-1516594, and the insurance wording (fully licensed and bonded, cargo limit of $250,000 per occurrence) are confirmed and shown. Nothing else is claimed: no crash record, no years in operation. Add a stat to `company.confirmedStats` only after the client confirms it.

## Legal

- [ ] Terms are a standard draft. Cal should confirm the `TODO(client)` items in `src/content/terms.ts` (cancellation window, refund timing, accepted payment methods at delivery, claim deadline, packing rules, surcharges, governing venue) and have the terms reviewed by an attorney before taking live deposits.

## Accounts and infrastructure

- [ ] Stripe account activated in the client's name (test keys now, live keys at launch).
- [ ] Booking inbox address (`BOOKINGS_EMAIL_TO`).
- [ ] Domain, purchased by the client, plus DNS access.
- [ ] Email sending domain access for SPF/DKIM verification (Resend).
- [ ] Google Analytics 4 measurement ID, if they want GA.

## Added after the ZIP review

- [ ] The East list still doesn't include Charlotte or Birmingham metro ZIPs, or anything in Florida (Atlanta metro, 30001–30400, is now included). Is that intentional?

## Stripe go-live (Phase 6)

- [ ] Live keys in Vercel Production only. Preview and Development keep test keys.
- [ ] A webhook endpoint per environment (`/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`), each with its own `STRIPE_WEBHOOK_SECRET` in Vercel. Until then the deployed app can take payments but cannot verify webhooks; the status check still marks bookings paid.
- [ ] Decide whether to keep Link ("Save my information for faster checkout") and the extra payment methods Stripe shows (Bank, Klarna). They are Dashboard settings.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` for the "deposit received" email.

## Email (Phase 7)

- [x] Sending domain `notify.951express.com` verified in Resend; `EMAIL_FROM` uses it. Customers now receive confirmations.
- [ ] Review the wording of the customer confirmation ("What happens next") in `src/content/emails.ts`.
- [x] Dispatcher inbox: 951.dispatcher@gmail.com (`BOOKINGS_EMAIL_TO`; also the Reply-To on customer emails). Add more addresses, comma separated, if the client wants them.

## Personalized quote routing (Cal's call, 2026-10-13)

These go to the quote form instead of online booking. The defaults below are in `src/config/eligibility.ts`.

- [ ] **Full-size vans** (Transit, Sprinter, Express, Savana, ProMaster): personalized quote (default) or a price?
- [ ] **Exotic list:** Ferrari, Lamborghini, McLaren, Rolls-Royce, Bentley, Aston Martin, Bugatti, Pagani, Koenigsegg, Maserati, Lotus, and any Maybach model. Keep Maserati and Lotus?
- [ ] **High value:** the "worth more than $100,000" threshold is `highValueThresholdUsd`. Is $100,000 right?

## Dispatch sheet PDF (Batch 6)

- [ ] **Confirm the carrier address** (`2108 Collett Ave Apt 204, Corona, CA 92879`) on the dispatch sheet (`company.dispatchAddress` in `src/config/company.ts`, from Cal's own sheet; used nowhere else).
- [ ] **VIN check:** a VIN is accepted when it is 17 letters and numbers with no I, O or Q. It is not checked against the VIN check digit, because older and imported vehicles often fail it. Add the check digit test?
- [ ] **Lot #** is left blank on the sheet for Cal to fill in his dispatch system. Is that right?
- [ ] **Estimated delivery** is the first day of the pickup week + 7 to the last day + 10 (for example "Oct 26 – Nov 4").

## West region: Yuma, AZ (Batch 7)
- [ ] Yuma-area ZIPs (85336, 85349, 85350, 85364, 85365, 85366, 85367, 85369) were added to West for **both pickup and delivery**, like the rest of the West list. Is Yuma pickup-only?
