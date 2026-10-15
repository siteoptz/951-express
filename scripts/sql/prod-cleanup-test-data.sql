-- Removes TEST-mode bookings (and their holds) and the test leads you list. Run it yourself in the Neon SQL editor on the
-- MAIN (production) branch. Read prod-inventory.sql first. Nothing here runs from the app.
--
-- It is wrapped in BEGIN ... ROLLBACK, so by default nothing is changed: it prints counts and the rows it WOULD delete.
-- Review them, then change the last line from ROLLBACK to COMMIT and run the whole script again.
--
-- What counts as test data:
--   * bookings (including held ones, which are the holds) whose Stripe Checkout Session ID starts with cs_test_
--   * leads whose email or id you list in test_leads below (leads have no Stripe mode, so they are never guessed)
-- Never touched: live bookings (cs_live_), holds with no session ID, routes, rates, settings, week_overrides.
-- Deleting a held booking frees its spot. Deleting a paid test booking does not refund anything (test money is not real).
--
-- Bookings and leads have no child tables, so a plain DELETE is complete. Nothing is deleted from Stripe.

BEGIN;

-- 1. EDIT THIS LIST: the leads you confirmed are test leads (by email, lower-case). Leave it empty to delete none.
CREATE TEMP TABLE test_leads (email text PRIMARY KEY) ON COMMIT DROP;
-- INSERT INTO test_leads (email) VALUES ('test@example.com'), ('someone@siteoptz.com');

-- 2. Counts before (check these against the inventory).
SELECT 'bookings to delete (cs_test_)'    AS what, count(*) AS n FROM bookings WHERE stripe_session_id LIKE 'cs_test_%'
UNION ALL
SELECT 'of those, still held (holds)',      count(*) FROM bookings WHERE stripe_session_id LIKE 'cs_test_%' AND status = 'held'
UNION ALL
SELECT 'of those, paid or completed',       count(*) FROM bookings WHERE stripe_session_id LIKE 'cs_test_%' AND status IN ('paid', 'completed')
UNION ALL
SELECT 'bookings KEPT (live)',              count(*) FROM bookings WHERE stripe_session_id LIKE 'cs_live_%'
UNION ALL
SELECT 'bookings KEPT (no session id or other)', count(*) FROM bookings
  WHERE stripe_session_id IS NULL OR (stripe_session_id NOT LIKE 'cs_test_%' AND stripe_session_id NOT LIKE 'cs_live_%')
UNION ALL
SELECT 'leads to delete (your list)',       count(*) FROM leads WHERE lower(email) IN (SELECT email FROM test_leads)
UNION ALL
SELECT 'leads KEPT',                        count(*) FROM leads WHERE lower(email) NOT IN (SELECT email FROM test_leads);

-- 3. The exact bookings that will go, for a last look.
SELECT b.created_at, b.status::text AS status, b.stripe_session_id,
       coalesce(b.customer ->> 'email', b.payer_email) AS email, r.slug AS route, b.week_start AS week
FROM bookings b JOIN routes r ON r.id = b.route_id
WHERE b.stripe_session_id LIKE 'cs_test_%'
ORDER BY b.created_at;

-- 4. The deletes.
DELETE FROM bookings WHERE stripe_session_id LIKE 'cs_test_%';
DELETE FROM leads WHERE lower(email) IN (SELECT email FROM test_leads);

-- 5. Counts after (inside the transaction).
SELECT (SELECT count(*) FROM bookings) AS bookings_left, (SELECT count(*) FROM leads) AS leads_left;

-- Default is ROLLBACK (nothing changes). To apply it, replace the next line with: COMMIT;
ROLLBACK;
