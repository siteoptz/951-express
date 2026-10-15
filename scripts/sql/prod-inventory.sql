-- READ-ONLY inventory of every booking, hold and lead, for the go-live cleanup review.
-- Run it yourself in the Neon SQL editor on the MAIN (production) branch. It only SELECTs.
--
-- Holds are not a separate table: a hold is a booking row with status 'held' (it takes a spot until it is paid or
-- expires). The database does not store Stripe's livemode, so the mode is read from the Checkout Session ID prefix:
-- cs_test_ = test mode, cs_live_ = live mode, no session ID = the hold was made but no Stripe session was saved.
-- Leads (quote requests) never touch Stripe, so they have no mode; review them by date and email.

SELECT
  'booking'                                   AS kind,
  b.id::text                                  AS id,
  b.created_at,
  b.status::text                              AS status,
  CASE
    WHEN b.stripe_session_id LIKE 'cs_test_%' THEN 'test'
    WHEN b.stripe_session_id LIKE 'cs_live_%' THEN 'live'
    WHEN b.stripe_session_id IS NULL          THEN 'no session'
    ELSE 'unknown'
  END                                         AS stripe_mode,
  b.stripe_session_id,
  coalesce(b.customer ->> 'email', b.payer_email) AS email,
  r.slug                                      AS route,
  b.week_start                                AS week
FROM bookings b
JOIN routes r ON r.id = b.route_id

UNION ALL

SELECT
  'lead',
  l.id::text,
  l.created_at,
  l.status::text,
  'n/a (no Stripe)',
  NULL,
  l.email,
  r.slug,
  l.preferred_week_start
FROM leads l
JOIN routes r ON r.id = l.route_id

ORDER BY created_at DESC;

-- Summary: how many rows of each kind, status and mode (this is the count the cleanup script will use).
SELECT
  b.status::text AS status,
  CASE
    WHEN b.stripe_session_id LIKE 'cs_test_%' THEN 'test'
    WHEN b.stripe_session_id LIKE 'cs_live_%' THEN 'live'
    WHEN b.stripe_session_id IS NULL          THEN 'no session'
    ELSE 'unknown'
  END AS stripe_mode,
  count(*) AS bookings
FROM bookings b
GROUP BY 1, 2
ORDER BY 1, 2;
