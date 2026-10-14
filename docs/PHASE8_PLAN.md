# Phase 8 plan: Terms page + admin view

**Status: on hold. Do not build until the client or Antonio says to resume.** This is the signed-proposal admin only.
It follows Phase 8 of `docs/BUILD_PLAN.md`, with the changes below. The `/terms` page is already done.

## Out of scope (Dispatch Pro add-on)

Driver or load assignment, dispatching, invoicing, customer messaging, lead or booking workflow statuses, in-admin
refunds, per-user accounts and roles. If a request sounds like one of these, it is the add-on, not this phase.

## Starting point

There is no `/admin`, no `/api/admin` and no proxy/middleware yet. The tables `bookings`, `leads`, `rates`, `settings`,
`week_overrides` and `routes` exist. `renderDispatchPdf` (`src/server/dispatch-pdf.ts`) is reused as is.

## Build order

Each step ships with tests, and is its own commit on a `phase-8-admin` branch. Preview URL first, `main` only after approval.

### 1. Auth, log, and rate limit

- **Login page:** `/admin/login` (password form, `noindex`). One shared password, `ADMIN_PASSWORD`. Not HTTP Basic Auth.
- **Session cookie:** signed (HMAC-SHA256 with `ADMIN_SESSION_SECRET`), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
  12-hour expiry. The expiry is inside the signed value and checked on the server, not only by the browser. Compare
  signatures in constant time.
- **Guard:** the proxy (Next 16 `proxy.ts`) redirects any `/admin/*` page without a valid session to `/admin/login`, and
  returns 401 for `/api/admin/*`. Every admin route handler re-checks the session itself, so the guard is not the only
  layer. The admin pages send `noindex` and `Cache-Control: no-store`.
- **Logout:** a button in the admin header posts to `/api/admin/logout`, which clears the cookie.
- **Failed-login rate limit:** stored in the database (serverless instances share no memory), keyed by client IP.
  Proposal: 5 failures in 15 minutes locks that IP out for 15 minutes, with a generic "Too many attempts, try again
  later" message and a `429`. A successful login clears the count. Failures wait a short fixed delay so timing does not
  leak anything.
- **Closed by default:** if `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` is unset, the admin refuses to open.
- **CSRF:** `SameSite=Lax` plus all state changes as `POST`/`PATCH`/`DELETE` requests that check the `Origin` header.
- **Env vars:** add `ADMIN_SESSION_SECRET` to `.env.example` (`ADMIN_PASSWORD` is already listed). Set both on Vercel only
  when told to. Generate the secret with `openssl rand -base64 32`.
- **`admin_log` table** (the first migration). One shared login, so there is no "who". Columns: `id`, `at`, `action`,
  `target` (for example `booking:<id>`, `rate:<class>`, `week:<route>:<week>`), `before` (jsonb), `after` (jsonb), `ip`,
  `user_agent`. Written in the same transaction as the change it records, so a change without a log row cannot happen.
  Failed and successful logins and logouts are logged too (`before`/`after` empty). The same migration adds the
  failed-login table for the rate limit.

### 2. Bookings

- A table filterable by status, route and week, with a "paid, details pending" flag.
- A detail drawer with all fields: a link to the Stripe payment, the optional vehicle color and VIN, the pickup and
  delivery contacts, `address_flags` with the "city/ZIP mismatch" review reason, the derived state and region of each
  address, and both the typed vehicle (`vehicle_typed`, as typed) and the normalized vehicle with its `review_reason`.
- **Dispatch sheet:** a "Download dispatch sheet" button backed by `GET /api/admin/bookings/[id]/dispatch.pdf`
  (session required). It reuses `renderDispatchPdf`.

### 3. Capacity and weeks grid

- Routes × the next 8 weeks, each cell showing taken/capacity. Top-deck usage per route and week (SUV slots and the car
  slot, taken and left).
- Actions: close or reopen a week, set a capacity override, set the top-deck SUV and car overrides
  (`week_overrides.top_deck_suv_override` and `top_deck_car_override`, which the capacity code already honors).
- **Cancel booking:** frees the spot. A confirmation dialog first, built into the page (not `window.confirm`), saying
  plainly that **cancelling does not refund the customer, and that refunds are done in the Stripe dashboard**. The
  dialog names the booking (customer, route, week) and has "Cancel booking" and "Keep booking" buttons.
- Every change takes the `pg_advisory_xact_lock(route_id, week_number)` lock the booking flow uses, so it cannot race a
  hold. The 7→6 and 5→3 concurrency tests stay green.

### 4. Rates

- Edit the base rate of each of the 7 size classes, the Top Deck surcharge, and the **deposit as a flat amount only**
  (no percent option; the `deposit` settings row stays flat, seeded at $100). No inoperable or modified surcharge,
  since those vehicles get a personalized quote.
- Values are validated on the server (whole dollars, sensible bounds) and the editor shows the old value next to the new
  one before saving.
- Quotes, holds and capacity read from the database, with config only as the fallback for a missing row. The seed never
  overwrites an edited value (`src/server/seed.db.test.ts` guards this).

### 5. Leads (read-only)

- A list of quote requests, filterable by reason (large vehicle, inoperable, modified, exotic, high value), and a detail
  view with `quote_reasons`, `modification_details`, and both the typed and the normalized vehicle.
- **No status field and no way to change a lead.** Tracking contacted or closed is the Dispatch Pro add-on. The existing
  `lead_status` column is left alone and not shown or edited.

## Done when

- Closing a week makes it show unavailable in the modal right away.
- Cancelling a booking frees the spot.
- A rate change shows up in the next quote.
- Wrong passwords are limited, a cookie older than 12 hours is refused, and logout ends the session.
- Every admin action has an `admin_log` row with before/after values, time, IP and user agent.

## Checks

`npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`, plus e2e for login, logout,
lockout, close week, cancel, and rate change. View each admin screen at 390px and 1280px.
