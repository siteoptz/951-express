-- One-time data changes from Cal's call on 2026-10-13. They run once per environment (through vercel-build),
-- so the seed never has to overwrite settings that Phase 8 lets the client edit.

-- Weekly capacity: 12 -> 6 per direction (Batch 3).
UPDATE "routes" SET "weekly_capacity" = 6 WHERE "slug" IN ('west-to-east', 'east-to-west');--> statement-breakpoint

-- Deposit: a flat $100 instead of 25% (Batch 2). The old percent setting goes away.
INSERT INTO "settings" ("key", "value", "updated_at")
VALUES ('deposit', '{"type":"flat","amountCents":10000}'::jsonb, now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'deposit_percent';--> statement-breakpoint

-- Inoperable and modified vehicles now get a personalized quote, so their online surcharges are retired (Batch 1).
DELETE FROM "settings" WHERE "key" IN ('inoperable_surcharge_cents', 'modified_surcharge_cents', 'modified_policy');
