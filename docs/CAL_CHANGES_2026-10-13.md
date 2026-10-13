# Client Change Requests: Oct 13, 2026 (call with Cal)

These changes come from a review call with Cal (951 Express). Work through them **one batch at a time, in order**.
After each batch: run lint, typecheck, test, the DB tests, e2e (plus `e2e:stripe` where payment is touched), and
build; show screenshots at 390px and 1280px; **wait for approval**; then commit that batch on its own and push to main.

Rules from CLAUDE.md still apply. In particular, the server is the source of truth for eligibility, price, capacity and
regions, so every rule below must be enforced server-side, not just in the UI.

Values marked **TODO(client)** use the default shown here and go in config; add each one to `docs/CLIENT_INPUTS.md` for Cal
to confirm.

---

## Batch 0: Status check (no code changes)
Before starting, report the status of these earlier items:
- the contact form that replaces the "Email Us" mailto links
- the Phase 8 basic admin area
- the password-manager attributes on ZIP inputs

If any of them aren't built yet, tell me. Don't start them unless I say so. Note where the batches below will need to
connect to them (the admin rates editor, the weeks grid, and the leads list).

---

## Batch 1: Online booking eligibility (personalized quote routing)
Several kinds of vehicle can no longer be booked online. Each one goes to the existing **"Request a personalized
quote"** form: the lead is stored and emailed, with no deposit and no hold.

| Reason code | Trigger | Message above the quote form |
|---|---|---|
| `large_vehicle` | Already built: large SUVs, full-size pickups (1500 and up), heavy duty, and full-size vans (Transit, Sprinter, Express, Savana, ProMaster). Vans are TODO(client) to confirm. | (existing) |
| `inoperable` | "Is the vehicle operable?" = **No** | "Vehicles that don't run need a personalized quote. Send us the details and we'll get back to you with a price." |
| `modified` | "Has it been modified?" = **Yes** | "Modified vehicles need a personalized quote so we can confirm it fits our trailer." |
| `exotic` | Make on the exotic list (config, case-insensitive): Ferrari, Lamborghini, McLaren, Rolls-Royce, Bentley, Aston Martin, Bugatti, Pagani, Koenigsegg, Maserati, Lotus; any model containing "Maybach". TODO(client) to confirm Maserati and Lotus. | "High-value and exotic vehicles need a personalized quote so we can arrange the right coverage." |
| `high_value` | New **required** radio right after the vehicle fields: "Is your vehicle worth more than $100,000?" = **Yes** (threshold in config) | same as `exotic` |

Requirements:
- When any trigger applies, immediately hide the rest of the booking steps (load type, personal items, pickup week,
  terms, price button) and show the quote form. Keep the ZIPs, vehicle and answers, plus the optional preferred pickup week.
  Changing an answer back restores the normal flow with answers kept.
- When modified = Yes, add a **required** field: "Describe the modifications" (placeholder "e.g. 5-inch lift, 35-inch
  tires, lowered 2 inches, roof rack"), max 500 chars.
- Server: `/api/quote` and `/api/checkout` return `quoteRequired` with `quoteReasons: string[]` and never create a hold or a
  Stripe session for these vehicles, whatever the browser sends.
- Leads store `quote_reasons` and `modification_details`. NewLeadEmail subject:
  `Quote request ({reasons}): {year make model} · {route}`, with the reasons and modification details at the top of the body.
- Remove the inoperable (+$150) and modified (+$100) surcharges and the "modified → needs review" path from online pricing,
  config, the seed/settings, the rates editor (if it exists) and the emails. Keep the DB columns for history.
- Terms: "Vehicles that don't run, modified vehicles, exotic or high-value vehicles (over $100,000), and large SUVs,
  pickups and vans require a personalized quote." Bump the terms version.
- Tests: each trigger switches the form, switching back restores it, the modification description is required, the API
  rejects checkout for every reason (including a forged request), leads store the reasons, and the email subjects are correct.

---

## Batch 2: Deposit, balance and delivery timeframe
1. **Deposit: a flat $100** on every booking, replacing 25%. Settings: `deposit { type: 'flat', amountCents: 10000 }`.
   Keep percent support in code. The seed must **UPDATE** the existing settings row in every environment. Balance = total − $100.
2. **Balance payment message**, from config (accepted methods: Cash, Cashier's Check, Zelle):
   > **Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.**
   Show it in the Step 2 cart directly under "Balance due at delivery" (visible before payment), the confirmation screen,
   the customer deposit and confirmation emails, the team NewBookingEmail, the dispatch sheet PDF (Batch 6), and the Terms.
   Replace the Terms TODO(client) for payment methods.
3. **Standard delivery timeframe: 7–10 days after pickup** (config: `deliveryWindowDays: { min: 7, max: 10 }`).
   Show it to the customer in the cart and confirmation as "Estimated delivery: 7–10 days after pickup", in the customer
   emails, in the Terms (as an estimate, not a guarantee, alongside the existing delays wording), and on the dispatch sheet
   as the estimated delivery (pickup week + 7–10 days, e.g. "Oct 26 – Nov 4").
4. Tests: the deposit is exactly $100 for every class with and without top deck, balance math, the balance message and
   delivery window appear in the cart, the confirmation and every email template, and the Terms version is bumped.

---

## Batch 3: Weekly capacity and top-deck limits
1. **Capacity: 6 per direction per week** (west-to-east 6, east-to-west 6), replacing 12.
   - Update the config default and the seed, and **UPDATE** existing route rows in every environment through an idempotent
     migration/seed step that runs in vercel-build.
   - Grep for every capacity "12" (copy, availability UI "N of 12", emails "spot N of 12", Terms, CLAUDE.md, BUILD_PLAN.md,
     tests). Always read the number from the route's capacity.
   - Concurrency test: 7 simultaneous holds → exactly 6 succeed.
   - Existing weeks with more than 6 test bookings just show as full. Don't delete anything.
2. **Top-deck limit**: the paid "Top Deck Load (+$150)" option is limited per route per week, enforced inside the same
   advisory-locked transaction as the main capacity. A top-deck booking uses one of the 6 spots **and** one top-deck slot.
   Defaults (all TODO(client) to confirm):
   - **3 SUV slots and 1 car slot** per route per week.
   - SUV-slot classes: small-suv, midsize-suv, minivan, small-pickup, midsize-pickup. Car-slot classes: small-sedan, large-sedan.
   - A sedan may use a free SUV slot when the car slot is taken.
   - Count held (unexpired), paid and completed top-deck bookings.
   - Modal: for the selected week, show "N top-deck spots left" on the Top Deck option. If none fit this vehicle, disable it
     with "Top deck sold out for this week. Standard loading is available, or pick another week." Recheck when the week or
     vehicle changes.
   - Server: `/api/quote`, `/api/checkout` and `createHold` recheck. A full slot type returns 409 with the next week that has
     top-deck space for this vehicle. The availability API returns top-deck remaining per slot type per week.
   - Admin (if built, or when built): show top-deck usage in the weeks grid and allow a per-week override.
   - Tests: fill the SUV slots and confirm the next SUV top-deck hold is rejected while standard still works; the car-slot
     rule and the sedan-into-SUV-slot fallback; concurrency (5 simultaneous SUV top-deck holds → exactly 3); the UI disabled state.

---

## Batch 4: Vehicle entry: plain typed fields (no dropdowns)
Customers didn't realize they had to type into the make/model pickers. Cal's decision: **no dropdowns**.
1. Three plain text inputs, each with a visible label above it, under the heading "Tell us about your vehicle":
   - "Type your vehicle's year": numeric, 4 digits, 1950 to current model year + 1
   - "Type the make (e.g. Toyota)"
   - "Type the model (e.g. Camry)"
   The next empty field gets the orange highlight ring. Inputs are 48px+ tall with a 16px+ font. No autocomplete list.
2. Server-side normalization in `src/lib` (tested):
   - trim, collapse spaces and match case-insensitively
   - make aliases in config (Chevy→Chevrolet, VW→Volkswagen, Mercedes/Benz/Merc→Mercedes-Benz, etc.)
   - match models ignoring spaces and hyphens (F150 = F-150, RAV 4 = RAV4, CRV = CR-V, Silverado1500 = Silverado 1500)
   - vPIC may be used only as a hidden server-side matching aid
3. Classification uses the normalized values against the class tables, the large/exotic lists and the year rules. If the
   vehicle isn't recognized, show the vehicle-type cards with examples, including "Large SUV / Full-size pickup / Van",
   which goes to the quote form. Set `needsReview` with the reason `vehicle not recognized: '{typed text}'`.
4. Store the **exact typed text** and the normalized values on bookings and leads. Show both in the team email, the admin
   and the dispatch sheet.
5. The high-value question and the inoperable/modified rules apply whether or not the vehicle is recognized.
6. Tests:
   - "chevy tahoe" → quote
   - "f150" → quote
   - "rav 4" → small-suv
   - misspelled "ferarri" + value Yes → quote
   - an unrecognized vehicle → type cards + needsReview
   - year validation
   - an e2e typing flow at mobile width

---

## Batch 5: Address consistency (bug from client testing)
A tester entered delivery ZIP 21771 (Mount Airy, MD) while the address state said California, and the booking completed.
1. **State** is derived from the ZIP on the server and shown read-only ("Maryland, from your ZIP"). No free entry.
2. **City** autofills from the ZIP and may be edited. On submit the server checks it against the ZIP. On a mismatch, show:
   "That city doesn't match ZIP 21771 (Mount Airy, MD). Please check your address." A confirmed override
   ("Yes, this is correct") sets `needsReview` with the reason "city/ZIP mismatch".
3. **Route integrity**: the Step 3 pickup and delivery ZIPs must stay in the regions of the paid route, rechecked on the server.
4. Show the region next to each address ("Delivery: Mount Airy, MD · East region").
5. Show address review flags in the team email, the admin booking detail and the dispatch sheet.
6. Find the tester's booking (delivery ZIP 21771) and report its stored address fields. Don't delete it.
7. Tests: a state mismatch is impossible, a city mismatch is blocked unless confirmed (then flagged), a region change in
   Step 3 is rejected, and an e2e that reproduces the reported case is now blocked.

---

## Batch 6: Dispatch sheet PDF
Cal enters bookings into his dispatch system (the sample sheet is "Powered by Super Dispatch"). Generate a PDF for every
completed booking using that sheet's **field layout**, with **951 Express branding only** (no broker or Super Dispatch branding).
1. Optional Step 3 fields (and schema): vehicle **color**, **VIN** (17 chars, validated if entered), **pickup contact**
   name/phone and **delivery contact** name/phone (default "same as customer").
2. Generate server-side with `@react-pdf/renderer`, US Letter. It must fit on one page for one vehicle. Sections, in this order:
   - Header: logo, "Dispatch Sheet", Order ID (booking ref)
   - Shipper (customer)
   - Carrier Information: 951 Express Inc, USDOT 4020917, MC-1516594, Corona CA address, dispatch email
   - Order Information: booking date, estimated pickup = pickup week, **estimated delivery = pickup week + 7–10 days**,
     Ship Via OPEN, load type (Top Deck flagged)
   - Payment: total, deposit paid online ($100), **balance to collect at delivery**, with
     **"Payment method: Cash, Cashier's Check, or Zelle only. No credit cards."**
   - Vehicle table: #, vehicle (normalized + typed text), type (size class), color, VIN, Lot # blank
   - Pickup and Delivery Information: names, full addresses, phones, contacts
   - Dispatch Instructions: customer notes, the 100 lb personal-items rule, any review flags
   - Footer: terms URL
3. Attach it to the NewBookingEmail as `951-Express-Dispatch-{ref}-{year}-{make}-{model}.pdf`. If generation fails, send
   the email without it and log the error.
4. Add `GET /api/admin/bookings/[id]/dispatch.pdf` (admin session) and a "Download dispatch sheet" button in the admin
   booking detail (or note it for Phase 8 if admin isn't built).
5. Tests: a snapshot of the PDF text, VIN validation, the attachment in the email payload, the failure path, and the
   delivery window and balance wording present.
6. Show me a sample PDF for a test booking before committing.

---

## Batch 7: West region ZIPs: Yuma, AZ area
Add these ZIPs to the **WEST** region. All are recognized; none are currently in either list:
`85336` Gadsden, `85349` San Luis, `85350` Somerton, `85364` `85365` `85366` `85367` `85369` Yuma (AZ).
- Same approach as the Atlanta additions: create `data/raw/west_additions.txt` with the header comment
  "Client request 2026-10-13: Yuma, AZ area" and these ZIPs. Have the build script merge it into west.json, keeping the
  overlap guard.
- West ZIPs are valid for **both pickup and delivery**, like the rest of the West list. TODO(client): confirm Yuma isn't
  pickup-only.
- Regenerate `src/data/zips/*`, add "Yuma" to the map's West metro labels, and update the landing copy that lists the West
  metros ("Southern California, Phoenix, Tucson, Yuma, and El Paso").
- Tests: 85364 resolves to West, 85364 → 30303 is West → East, 85364 → 92879 is rejected as same_region, coverage totals pass.

---

## Batch 8: Hero image swap
- **Hero:** the black-and-white truck photo (currently gallery item 2, `hauler-black-white`). Re-export it from `originals/`
  at the largest size available (target ≥2400px wide). If the original is no larger than 1500px, use it and tell me.
- Keep the truck, the "951" on the cab and the full load in frame at 390px and 1280px. The headline sits over the sky/left
  area with the navy overlay at AA contrast. Tune object-position so the cab isn't cut off on phones.
- Alt text: "A 951 Express truck hauling eight vehicles, in black and white."
- **Gallery item 2:** replace it with the current hero (`red-cascadia-profile`), using a gallery-sized export and its
  existing alt text.
- Keep priority loading on the hero, with no layout shift. Report the file sizes.

---

## Open questions for Cal (add to CLIENT_INPUTS.md)
- Full-size vans: personalized quote (default) or a price?
- Exotic list: keep Maserati and Lotus?
- Top deck: is it 3 SUVs **and** 1 car at the same time? Are minivans and small/midsize pickups allowed on top? May a sedan use an SUV slot?
- Yuma ZIPs: pickup and delivery (default), or pickup only?
- Street-address verification service (Smarty / Google Address Validation, a small per-lookup cost): yes or no?
