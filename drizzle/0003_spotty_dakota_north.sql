ALTER TABLE "leads" ADD COLUMN "quote_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "modification_details" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "high_value" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Every lead before this change was a large-vehicle request.
UPDATE "leads" SET "quote_reasons" = '["large_vehicle"]'::jsonb WHERE "quote_reasons" = '[]'::jsonb;
