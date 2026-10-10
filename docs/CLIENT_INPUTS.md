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
- [x] ZIP lists and direction rules (West ↔ East only), received. Confirm the East list is final: it is built from whole 3-digit ZIP blocks and leaves out the Atlanta area (300-303), Charlotte (280-282), Birmingham (350-352), and all of Florida and the Northeast above Delaware.
- [x] Base rates per size class, received.
- [ ] Do the inoperable (+$150) and modified (+$100) surcharges still apply, or are modified vehicles manual review?
- [ ] Is the deposit still 25%?
- [ ] Can inoperable vehicles go on the top deck?
- [ ] Is there a limit on top-deck spots per truck?
- [ ] Confirm the sedan and SUV class lists and the pickup year cutoffs (Ranger 2013-2018 is unclassified: those years were not sold in the U.S., so the customer picks).
- [ ] Should full-size vans (Transit, Sprinter, Express, Savana, ProMaster) be quote-required? Savana was added as the Express twin.
- [ ] Weekly capacity per route (placeholder: 12 per direction).
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
- [ ] The East list doesn't include Atlanta, Charlotte, or Birmingham metro ZIPs, or anything in Florida. Is that intentional?

## Stripe go-live (Phase 6)
- [ ] Live keys in Vercel Production only. Preview and Development keep test keys.
- [ ] A webhook endpoint per environment (`/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`), each with its own `STRIPE_WEBHOOK_SECRET` in Vercel. Until then the deployed app can take payments but cannot verify webhooks; the status check still marks bookings paid.
- [ ] Decide whether to keep Link ("Save my information for faster checkout") and the extra payment methods Stripe shows (Bank, Klarna). They are Dashboard settings.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` for the "deposit received" email.

## Email (Phase 7)
- [x] Sending domain `notify.951express.com` verified in Resend; `EMAIL_FROM` uses it. Customers now receive confirmations.
- [ ] Review the wording of the customer confirmation ("What happens next") in `src/content/emails.ts`.
- [x] Dispatcher inbox: 951.dispatcher@gmail.com (`BOOKINGS_EMAIL_TO`; also the Reply-To on customer emails). Add more addresses, comma separated, if the client wants them.
